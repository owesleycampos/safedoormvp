"""
Safe Door Brasil — API Client
Handles communication with the Next.js backend.
Implements retry logic and error handling.
"""
import uuid
from datetime import datetime
from typing import Optional
import httpx
import structlog

from config import config

logger = structlog.get_logger()

RETRY_DELAYS = [1, 2, 4, 8]  # seconds


class ApiClient:
    def __init__(self):
        self.base_url = config.api_base_url.rstrip('/')
        self.device_headers = {
            'x-device-api-key': config.device_api_key,
            'Content-Type': 'application/json',
        }
        self.agent_headers = {
            'x-agent-secret': config.agent_api_secret,
            'Content-Type': 'application/json',
        }
        self._client = httpx.AsyncClient(timeout=15.0)

    async def sync_face_vectors(self) -> Optional[dict]:
        """
        Fetch all student face vectors from the server.
        Returns sync data including device info and students.
        """
        try:
            resp = await self._client.get(
                f"{self.base_url}/api/students/vectors",
                headers=self.device_headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.info("Face vectors synced", count=len(data.get('students', [])))
                return data
            else:
                logger.error("Sync failed", status=resp.status_code, body=resp.text[:200])
                return None
        except httpx.RequestError as e:
            logger.warning("Network error during sync", error=str(e))
            return None

    async def send_checkin_event(
        self,
        student_id: str,
        event_type: str,
        device_id: str,
        confidence: float,
        timestamp: datetime,
        photo_url: Optional[str] = None,
    ) -> bool:
        """
        Send a face recognition event to the backend.
        Returns True if successful.
        """
        payload = {
            'studentId': student_id,
            'deviceId': device_id,
            'eventType': event_type,
            'confidence': confidence,
            'timestamp': timestamp.isoformat(),
            'photoUrl': photo_url,
        }

        for attempt, delay in enumerate([0] + RETRY_DELAYS):
            if attempt > 0:
                import asyncio
                await asyncio.sleep(delay)

            try:
                resp = await self._client.post(
                    f"{self.base_url}/api/events/checkin-checkout",
                    headers=self.agent_headers,
                    json=payload,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    if data.get('skipped'):
                        logger.info(
                            "Event skipped (duplicate)",
                            reason=data.get('reason'),
                            student_id=student_id,
                        )
                    else:
                        logger.info(
                            "Event sent",
                            student_id=student_id,
                            event_type=event_type,
                            confidence=confidence,
                        )
                    return True
                elif resp.status_code == 422:
                    logger.warning("Confidence below threshold", student_id=student_id)
                    return True  # Not a network error, stop retrying
                else:
                    logger.warning(
                        "Event rejected",
                        status=resp.status_code,
                        body=resp.text[:200],
                        attempt=attempt + 1,
                    )
            except httpx.RequestError as e:
                logger.warning("Network error sending event", error=str(e), attempt=attempt + 1)

        return False

    async def send_unrecognized_log(
        self,
        school_id: str,
        device_id: str,
        photo_url: str,
        confidence_score: Optional[float],
        timestamp: datetime,
    ) -> bool:
        """Log an unrecognized face to the server."""
        payload = {
            'schoolId': school_id,
            'deviceId': device_id,
            'photoUrl': photo_url,
            'confidenceScore': confidence_score,
            'timestamp': timestamp.isoformat(),
        }

        for attempt, delay in enumerate([0] + RETRY_DELAYS[:2]):
            if attempt > 0:
                import asyncio
                await asyncio.sleep(delay)
            try:
                resp = await self._client.post(
                    f"{self.base_url}/api/events/unrecognized",
                    headers=self.agent_headers,
                    json=payload,
                )
                if resp.status_code in (200, 201):
                    return True
            except httpx.RequestError:
                pass

        return False

    async def close(self):
        await self._client.aclose()
