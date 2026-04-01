"""
Safe Door Brasil — Sync Manager
Handles offline-first data syncing between local SQLite and the cloud backend.
"""
import asyncio
import uuid
from datetime import datetime
from typing import Optional
import structlog

from api_client import ApiClient
from local_db import LocalDatabase
from config import config

logger = structlog.get_logger()


class SyncManager:
    """
    Manages the sync queue between offline local storage and the cloud API.
    Runs periodic sync and handles retry logic.
    """

    def __init__(self, local_db: LocalDatabase, api_client: ApiClient):
        self.db = local_db
        self.api = api_client
        self._is_online = False
        self._sync_task: Optional[asyncio.Task] = None
        self._device_id: Optional[str] = None
        self._school_id: Optional[str] = None

    def set_device_info(self, device_id: str, school_id: str):
        self._device_id = device_id
        self._school_id = school_id

    async def check_connectivity(self) -> bool:
        """Ping the server to check if we're online."""
        try:
            data = await self.api.sync_face_vectors()
            self._is_online = data is not None
        except Exception:
            self._is_online = False
        return self._is_online

    async def sync_face_vectors(self, face_engine) -> bool:
        """
        Pull latest student face vectors from server and update local cache.
        Returns True if successful.
        """
        data = await self.api.sync_face_vectors()
        if not data:
            logger.warning("Could not sync face vectors (offline)")
            # Fall back to local cache
            cached = self.db.get_cached_students()
            if cached:
                logger.info("Using cached student data", count=len(cached))
                face_engine.load_students(cached)
            return False

        # Update device/school info
        if data.get('deviceId'):
            self._device_id = data['deviceId']
        if data.get('schoolId'):
            self._school_id = data['schoolId']

        students = data.get('students', [])

        # Update local cache
        self.db.update_student_cache(students)

        # Load into face engine
        loaded = face_engine.load_students(students)
        logger.info("Face vectors synced and loaded", total=len(students), with_vectors=loaded)
        return True

    async def queue_attendance_event(
        self,
        student_id: str,
        event_type: str,
        confidence: float,
        timestamp: datetime,
        photo_url: Optional[str] = None,
    ):
        """
        Try to send event immediately; if offline, queue locally.
        """
        event_id = str(uuid.uuid4())

        if self._is_online:
            success = await self.api.send_checkin_event(
                student_id=student_id,
                event_type=event_type,
                device_id=self._device_id or 'unknown',
                confidence=confidence,
                timestamp=timestamp,
                photo_url=photo_url,
            )
            if success:
                logger.info("Event sent immediately", student_id=student_id, event_type=event_type)
                self.db.record_daily_event(student_id, event_type, timestamp)
                return

        # Queue for later sync
        self.db.queue_event(
            event_id=event_id,
            student_id=student_id,
            event_type=event_type,
            timestamp=timestamp,
            device_id=self._device_id,
            confidence=confidence,
            photo_url=photo_url,
        )
        self.db.record_daily_event(student_id, event_type, timestamp)
        logger.warning("Event queued offline", student_id=student_id, event_id=event_id)

    async def queue_unrecognized_log(
        self,
        photo_url: str,
        confidence: Optional[float],
        timestamp: datetime,
    ):
        """Queue an unrecognized face log."""
        if not self._school_id or not self._device_id:
            return

        log_id = str(uuid.uuid4())

        if self._is_online:
            success = await self.api.send_unrecognized_log(
                school_id=self._school_id,
                device_id=self._device_id,
                photo_url=photo_url,
                confidence_score=confidence,
                timestamp=timestamp,
            )
            if success:
                return

        self.db.queue_unrecognized(
            log_id=log_id,
            school_id=self._school_id,
            device_id=self._device_id,
            photo_url=photo_url,
            confidence=confidence,
            timestamp=timestamp,
        )

    async def flush_pending_events(self) -> tuple[int, int]:
        """
        Try to sync all pending offline events to the server.
        Returns (synced_count, failed_count).
        """
        pending = self.db.get_pending_events()
        synced = failed = 0

        for event in pending:
            success = await self.api.send_checkin_event(
                student_id=event['student_id'],
                event_type=event['event_type'],
                device_id=event['device_id'] or self._device_id or 'unknown',
                confidence=event['confidence'] or 0.95,
                timestamp=datetime.fromisoformat(event['timestamp']),
                photo_url=event['photo_url'],
            )
            if success:
                self.db.mark_event_synced(event['id'])
                synced += 1
            else:
                self.db.increment_event_attempts(event['id'], "Failed to sync")
                failed += 1

        # Flush unrecognized logs
        for log in self.db.get_pending_unrecognized():
            success = await self.api.send_unrecognized_log(
                school_id=log['school_id'],
                device_id=log['device_id'],
                photo_url=log['photo_url'],
                confidence_score=log['confidence'],
                timestamp=datetime.fromisoformat(log['timestamp']),
            )
            if success:
                self.db.mark_unrecognized_synced(log['id'])

        if synced or failed:
            logger.info("Flush complete", synced=synced, failed=failed)

        return synced, failed

    async def start_periodic_sync(self, face_engine, interval_seconds: int = 300):
        """Start background periodic sync loop."""
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                is_online = await self.check_connectivity()
                if is_online:
                    await self.sync_face_vectors(face_engine)
                    synced, _ = await self.flush_pending_events()
                    if synced:
                        logger.info("Background sync complete", synced=synced)
            except Exception as e:
                logger.error("Background sync error", error=str(e))
