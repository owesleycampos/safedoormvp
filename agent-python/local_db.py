"""
Local SQLite database for offline mode.
Stores events and student face vectors for when internet is unavailable.
"""
import sqlite3
import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import structlog

logger = structlog.get_logger()


class LocalDatabase:
    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._lock, self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS pending_events (
                    id          TEXT PRIMARY KEY,
                    student_id  TEXT NOT NULL,
                    device_id   TEXT,
                    event_type  TEXT NOT NULL,
                    confidence  REAL,
                    photo_url   TEXT,
                    timestamp   TEXT NOT NULL,
                    synced      INTEGER DEFAULT 0,
                    attempts    INTEGER DEFAULT 0,
                    created_at  TEXT DEFAULT (datetime('now')),
                    error       TEXT
                );

                CREATE TABLE IF NOT EXISTS pending_unrecognized (
                    id              TEXT PRIMARY KEY,
                    school_id       TEXT NOT NULL,
                    device_id       TEXT NOT NULL,
                    photo_url       TEXT NOT NULL,
                    confidence      REAL,
                    timestamp       TEXT NOT NULL,
                    synced          INTEGER DEFAULT 0,
                    attempts        INTEGER DEFAULT 0,
                    created_at      TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS student_cache (
                    id                  TEXT PRIMARY KEY,
                    name                TEXT NOT NULL,
                    class_name          TEXT,
                    photo_url           TEXT,
                    face_vector_b64     TEXT,
                    face_vector_version INTEGER DEFAULT 1,
                    updated_at          TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS daily_log (
                    student_id  TEXT NOT NULL,
                    event_type  TEXT NOT NULL,
                    date        TEXT NOT NULL,
                    timestamp   TEXT NOT NULL,
                    PRIMARY KEY (student_id, event_type, date)
                );

                CREATE INDEX IF NOT EXISTS idx_pending_events_synced
                    ON pending_events(synced, created_at);
                CREATE INDEX IF NOT EXISTS idx_daily_log
                    ON daily_log(student_id, date);
            """)
        logger.info("Local database initialized", path=self.db_path)

    # ── Event Queue ────────────────────────────────────────────────────────────

    def queue_event(
        self,
        event_id: str,
        student_id: str,
        event_type: str,
        timestamp: datetime,
        device_id: Optional[str] = None,
        confidence: Optional[float] = None,
        photo_url: Optional[str] = None,
    ):
        with self._lock, self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO pending_events
                    (id, student_id, device_id, event_type, confidence, photo_url, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (event_id, student_id, device_id, event_type,
                  confidence, photo_url, timestamp.isoformat()))
        logger.info("Event queued for sync", event_id=event_id, event_type=event_type)

    def get_pending_events(self, limit: int = 50) -> list[dict]:
        with self._lock, self._get_conn() as conn:
            rows = conn.execute("""
                SELECT * FROM pending_events
                WHERE synced = 0 AND attempts < 5
                ORDER BY timestamp ASC
                LIMIT ?
            """, (limit,)).fetchall()
        return [dict(r) for r in rows]

    def mark_event_synced(self, event_id: str):
        with self._lock, self._get_conn() as conn:
            conn.execute(
                "UPDATE pending_events SET synced = 1 WHERE id = ?",
                (event_id,)
            )

    def increment_event_attempts(self, event_id: str, error: str = ""):
        with self._lock, self._get_conn() as conn:
            conn.execute("""
                UPDATE pending_events
                SET attempts = attempts + 1, error = ?
                WHERE id = ?
            """, (error, event_id))

    # ── Unrecognized Log Queue ─────────────────────────────────────────────────

    def queue_unrecognized(self, log_id: str, school_id: str, device_id: str,
                           photo_url: str, confidence: Optional[float], timestamp: datetime):
        with self._lock, self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO pending_unrecognized
                    (id, school_id, device_id, photo_url, confidence, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (log_id, school_id, device_id, photo_url, confidence, timestamp.isoformat()))

    def get_pending_unrecognized(self, limit: int = 20) -> list[dict]:
        with self._lock, self._get_conn() as conn:
            rows = conn.execute("""
                SELECT * FROM pending_unrecognized
                WHERE synced = 0 AND attempts < 5
                LIMIT ?
            """, (limit,)).fetchall()
        return [dict(r) for r in rows]

    def mark_unrecognized_synced(self, log_id: str):
        with self._lock, self._get_conn() as conn:
            conn.execute(
                "UPDATE pending_unrecognized SET synced = 1 WHERE id = ?",
                (log_id,)
            )

    # ── Student Cache ──────────────────────────────────────────────────────────

    def update_student_cache(self, students: list[dict]):
        with self._lock, self._get_conn() as conn:
            # Clear old cache
            conn.execute("DELETE FROM student_cache")
            for s in students:
                conn.execute("""
                    INSERT INTO student_cache
                        (id, name, class_name, photo_url, face_vector_b64, face_vector_version)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    s['id'], s['name'], s.get('className'),
                    s.get('photoUrl'), s.get('faceVectorB64'),
                    s.get('faceVectorVersion', 1),
                ))
        logger.info("Student cache updated", count=len(students))

    def get_cached_students(self) -> list[dict]:
        with self._lock, self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM student_cache WHERE face_vector_b64 IS NOT NULL"
            ).fetchall()
        return [dict(r) for r in rows]

    # ── Daily Deduplication Log ────────────────────────────────────────────────

    def has_event_today(self, student_id: str, event_type: str) -> bool:
        today = datetime.now().strftime('%Y-%m-%d')
        with self._lock, self._get_conn() as conn:
            row = conn.execute("""
                SELECT 1 FROM daily_log
                WHERE student_id = ? AND event_type = ? AND date = ?
            """, (student_id, event_type, today)).fetchone()
        return row is not None

    def record_daily_event(self, student_id: str, event_type: str, timestamp: datetime):
        today = timestamp.strftime('%Y-%m-%d')
        with self._lock, self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO daily_log (student_id, event_type, date, timestamp)
                VALUES (?, ?, ?, ?)
            """, (student_id, event_type, today, timestamp.isoformat()))
