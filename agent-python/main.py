"""
Safe Door Brasil — Main Agent Entry Point
Runs the face recognition pipeline on the tablet camera.

Usage:
    python main.py

Requirements:
    - .env file with configuration (copy from .env.example)
    - Camera connected to device
    - Network access to Safe Door API (or works offline with local cache)
"""
import asyncio
import os
import sys
import signal
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
import cv2
import numpy as np
import structlog

# Setup logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
        structlog.dev.ConsoleRenderer(),
    ],
)
logger = structlog.get_logger()

from config import config
from face_engine import FaceEngine, RecognitionResult
from local_db import LocalDatabase
from api_client import ApiClient
from sync_manager import SyncManager


def get_event_type(schedule: Optional[dict] = None) -> str:
    """
    Determine ENTRY or EXIT based on current time or forced mode.

    Windows come from the SCHOOL settings synced from the server (source of
    truth); the local .env values are only a fallback for first boot while
    offline.

    Outside both windows, the pivot is the START OF THE EXIT WINDOW, not a
    hardcoded noon: anything before the exit window is a (late) ENTRY.
    A student arriving at 12:30 with an 11:00–18:00 exit window is still an
    exit-window case, but a 12:30 arrival with a 17:00 exit start correctly
    registers as a late ENTRY instead of a bogus EXIT.
    """
    if config.forced_mode:
        return config.forced_mode.upper()

    entry_start = (schedule or {}).get('entryStart') or config.entry_start
    entry_end = (schedule or {}).get('entryEnd') or config.entry_end
    exit_start = (schedule or {}).get('exitStart') or config.exit_start
    exit_end = (schedule or {}).get('exitEnd') or config.exit_end

    current_time = datetime.now().strftime('%H:%M')

    if entry_start <= current_time <= entry_end:
        return 'ENTRY'
    if exit_start <= current_time <= exit_end:
        return 'EXIT'

    return 'ENTRY' if current_time < exit_start else 'EXIT'


def save_frame_photo(frame: np.ndarray, student_id: Optional[str] = None) -> Optional[str]:
    """Save a frame to the photo cache directory. Returns local path."""
    try:
        photo_dir = Path(config.photo_cache_dir)
        photo_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        prefix = student_id or 'unrecognized'
        filename = f"{prefix}_{ts}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = photo_dir / filename

        cv2.imwrite(str(filepath), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return str(filepath)  # TODO: Upload to S3 and return URL
    except Exception as e:
        logger.error("Failed to save photo", error=str(e))
        return None


class SafeDoorAgent:
    def __init__(self):
        self.db = LocalDatabase(config.local_db_path)
        self.api = ApiClient()
        self.sync = SyncManager(self.db, self.api)
        self.engine = FaceEngine(
            encryption_key=config.encryption_key,
            min_confidence=config.min_confidence,
        )

        self._running = False
        self._cap: Optional[cv2.VideoCapture] = None
        self._last_recognition: dict[str, datetime] = {}  # student_id -> last seen time
        self._cooldown = config.recognition_cooldown  # seconds

    async def initialize(self):
        """Initialize the agent: sync face vectors, setup camera."""
        logger.info("🛡️  Safe Door Brasil Agent starting...")

        # Check connectivity and sync
        is_online = await self.sync.check_connectivity()
        logger.info("Connectivity", online=is_online)

        await self.sync.sync_face_vectors(self.engine)

        # Setup camera
        self._cap = cv2.VideoCapture(config.camera_index)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.camera_width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.camera_height)
        self._cap.set(cv2.CAP_PROP_FPS, config.capture_fps)

        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open camera index {config.camera_index}")

        logger.info(
            "Camera ready",
            width=config.camera_width,
            height=config.camera_height,
            fps=config.capture_fps,
        )

    def is_in_cooldown(self, student_id: str) -> bool:
        """Check if a student was recently recognized (cooldown period)."""
        last = self._last_recognition.get(student_id)
        if not last:
            return False
        elapsed = (datetime.now() - last).total_seconds()
        return elapsed < self._cooldown

    async def process_recognition(self, result: RecognitionResult):
        """Handle a successful recognition result."""
        student = result.student
        if not student:
            return

        # Cooldown check
        if self.is_in_cooldown(student.id):
            return

        # Liveness check
        if not result.is_liveness_confirmed:
            logger.warning("Liveness check failed", student_id=student.id)
            return

        event_type = get_event_type(self.sync.school_schedule)
        timestamp = datetime.now()

        # Check daily deduplication (1 entry + 1 exit per day)
        if event_type == 'ENTRY' and self.db.has_event_today(student.id, 'ENTRY'):
            logger.debug("Entry already recorded today", student=student.name)
            self._last_recognition[student.id] = timestamp
            return

        # Save photo locally (audit/debug). NOT sent to the server: a
        # tablet-local file path is not a URL the web app can render.
        # TODO: upload to S3/Blob and send the resulting URL.
        if result.frame is not None:
            save_frame_photo(result.frame, student.id)

        # Queue/send event
        await self.sync.queue_attendance_event(
            student_id=student.id,
            event_type=event_type,
            confidence=result.confidence,
            timestamp=timestamp,
            photo_url=None,
        )

        self._last_recognition[student.id] = timestamp

        logger.info(
            "✅ Recognition event",
            student=student.name,
            class_name=student.class_name,
            event_type=event_type,
            confidence=f"{result.confidence:.1%}",
        )

        # Visual feedback (terminal)
        print(f"\n{'='*50}")
        print(f"  {'🟢 ENTRADA' if event_type == 'ENTRY' else '🔵 SAÍDA'}")
        print(f"  {student.name}")
        print(f"  Turma: {student.class_name}")
        print(f"  Confiança: {result.confidence:.1%}")
        print(f"  Horário: {timestamp.strftime('%H:%M:%S')}")
        print(f"{'='*50}\n")

    async def process_unrecognized(self, result: RecognitionResult):
        """Handle an unrecognized face."""
        logger.debug(
            "Unrecognized face",
            confidence=f"{result.confidence:.1%}",
        )

        # Only log if there's some confidence (actual face detected, not random)
        if result.confidence > 0.3:  # Some resemblance but below threshold
            # Save locally for review on the device. The server requires an
            # accessible URL for review photos, so we don't push a local
            # file path — it would render as a broken image in the admin UI.
            # TODO: upload to S3/Blob, then queue_unrecognized_log(url).
            if result.frame is not None:
                photo_path = save_frame_photo(result.frame, None)
                if photo_path:
                    logger.info("Unrecognized face saved locally", path=photo_path)

    async def run_camera_loop(self):
        """Main camera capture and processing loop."""
        frame_skip = 0
        process_every = max(1, int(30 / config.capture_fps))  # Skip frames for performance

        logger.info("📷 Camera loop started — Press Ctrl+C to stop")

        while self._running:
            ret, frame = self._cap.read()
            if not ret:
                logger.error("Failed to capture frame")
                await asyncio.sleep(0.1)
                continue

            frame_skip += 1
            if frame_skip % process_every != 0:
                await asyncio.sleep(0.01)
                continue

            # Process frame
            try:
                results = self.engine.process_frame(frame)

                for result in results:
                    if result.student and result.confidence >= config.min_confidence:
                        await self.process_recognition(result)
                    elif result.confidence > 0:
                        await self.process_unrecognized(result)

            except Exception as e:
                logger.error("Frame processing error", error=str(e))

            await asyncio.sleep(0.05)  # ~20fps max processing

    async def start(self):
        """Start the agent."""
        await self.initialize()
        self._running = True

        # Start background tasks
        sync_task = asyncio.create_task(
            self.sync.start_periodic_sync(self.engine, config.vector_sync_interval)
        )

        camera_task = asyncio.create_task(self.run_camera_loop())

        try:
            await asyncio.gather(camera_task, sync_task)
        except asyncio.CancelledError:
            logger.info("Agent shutting down...")
        finally:
            await self.stop()

    async def stop(self):
        """Gracefully stop the agent."""
        self._running = False
        if self._cap:
            self._cap.release()
        await self.api.close()

        # Final sync attempt
        logger.info("Attempting final sync before shutdown...")
        await self.sync.flush_pending_events()
        logger.info("Agent stopped.")


async def main():
    agent = SafeDoorAgent()

    def handle_shutdown(sig, frame):
        logger.info(f"Signal {sig} received, shutting down...")
        agent._running = False

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    await agent.start()


if __name__ == '__main__':
    asyncio.run(main())
