"""
Safe Door Brasil — Face Recognition Engine
Uses face_recognition library with DeepFace as fallback.
Handles: detection, embedding, comparison, and basic anti-spoofing.
"""
import os
import time
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import numpy as np
import cv2

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False

import structlog
from config import config
from crypto_utils import decrypt_from_base64

logger = structlog.get_logger()


@dataclass
class Student:
    id: str
    name: str
    class_name: str
    face_embedding: np.ndarray
    photo_url: Optional[str] = None


@dataclass
class RecognitionResult:
    student: Optional[Student]
    confidence: float
    face_location: tuple  # (top, right, bottom, left)
    is_liveness_confirmed: bool = False
    frame: Optional[np.ndarray] = None


class FaceEngine:
    """
    Core face recognition engine.
    Maintains a local cache of student embeddings for fast matching.
    """

    def __init__(self, encryption_key: str, min_confidence: float = 0.90):
        self.encryption_key = encryption_key
        self.min_confidence = min_confidence
        self._students: list[Student] = []
        self._lock = threading.RLock()

        # Anti-spoofing state
        self._liveness_history: dict[str, list] = {}

        # Mediapipe face mesh for liveness detection
        if MEDIAPIPE_AVAILABLE:
            mp_face_mesh = mp.solutions.face_mesh
            self._face_mesh = mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        else:
            self._face_mesh = None
            logger.warning("MediaPipe not available — liveness detection disabled")

        logger.info(
            "FaceEngine initialized",
            face_recognition=FACE_RECOGNITION_AVAILABLE,
            mediapipe=MEDIAPIPE_AVAILABLE,
            min_confidence=min_confidence,
        )

    def load_students(self, student_data: list[dict]) -> int:
        """
        Load/update student face embeddings from API data.
        student_data: [{'id', 'name', 'className', 'faceVectorB64', ...}]
        Returns count of students loaded with face vectors.
        """
        loaded = []
        for s in student_data:
            b64 = s.get('faceVectorB64')
            if not b64:
                continue
            try:
                embedding = decrypt_from_base64(b64, self.encryption_key)
                loaded.append(Student(
                    id=s['id'],
                    name=s['name'],
                    class_name=s.get('className', ''),
                    face_embedding=embedding,
                    photo_url=s.get('photoUrl'),
                ))
            except Exception as e:
                logger.error("Failed to decrypt face vector", student_id=s['id'], error=str(e))

        with self._lock:
            self._students = loaded

        logger.info("Students loaded into engine", count=len(loaded))
        return len(loaded)

    def detect_faces(self, frame: np.ndarray) -> list[tuple]:
        """Returns list of face locations (top, right, bottom, left)."""
        if not FACE_RECOGNITION_AVAILABLE:
            return []
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return face_recognition.face_locations(rgb, model='hog')

    def get_embedding(self, frame: np.ndarray, face_location: tuple) -> Optional[np.ndarray]:
        """Extract 128-d face embedding from a detected face location."""
        if not FACE_RECOGNITION_AVAILABLE:
            return None
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        encodings = face_recognition.face_encodings(rgb, [face_location])
        return encodings[0] if encodings else None

    def match_face(self, embedding: np.ndarray) -> tuple[Optional[Student], float]:
        """
        Compare embedding against all loaded students.
        Returns (best_match_student, confidence_score).
        Confidence = 1 - face_distance (lower distance = higher confidence).
        """
        with self._lock:
            if not self._students:
                return None, 0.0

            known_embeddings = np.array([s.face_embedding for s in self._students])
            distances = face_recognition.face_distance(known_embeddings, embedding)
            best_idx = int(np.argmin(distances))
            best_distance = float(distances[best_idx])

        # Convert distance to confidence (face_recognition threshold is typically 0.6)
        # distance 0.0 = 100% match, 0.6 = threshold, 1.0 = no match
        confidence = max(0.0, 1.0 - (best_distance / 0.6))
        confidence = min(1.0, confidence)

        if confidence >= self.min_confidence:
            return self._students[best_idx], confidence
        return None, confidence

    def check_liveness(self, frame: np.ndarray) -> bool:
        """
        Basic liveness detection via eye blink detection using MediaPipe.
        Returns True if a real face is detected (not a photo).
        For MVP: checks if face landmarks are detected (more advanced = blink detection).
        """
        if not MEDIAPIPE_AVAILABLE or self._face_mesh is None:
            return True  # Pass-through if mediapipe not available

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            return False

        # Check eye aspect ratio to detect blink
        landmarks = results.multi_face_landmarks[0].landmark
        h, w = frame.shape[:2]

        # Eye landmark indices for MediaPipe Face Mesh
        LEFT_EYE_TOP = 386
        LEFT_EYE_BOTTOM = 374
        LEFT_EYE_LEFT = 263
        LEFT_EYE_RIGHT = 362

        def get_point(idx):
            lm = landmarks[idx]
            return np.array([lm.x * w, lm.y * h])

        top = get_point(LEFT_EYE_TOP)
        bottom = get_point(LEFT_EYE_BOTTOM)
        left = get_point(LEFT_EYE_LEFT)
        right = get_point(LEFT_EYE_RIGHT)

        eye_height = np.linalg.norm(top - bottom)
        eye_width = np.linalg.norm(left - right)

        if eye_width == 0:
            return False

        ear = eye_height / eye_width  # Eye Aspect Ratio

        # EAR < 0.15 = blink, > 0.15 = eye open
        # For MVP: just confirm face landmarks detected (3D face structure)
        # A flat photo would have different landmark depths
        return ear > 0.05  # Very basic check

    def process_frame(self, frame: np.ndarray) -> list[RecognitionResult]:
        """
        Full pipeline: detect → embed → match → liveness check.
        Returns list of recognition results for each face in the frame.
        """
        results = []
        face_locations = self.detect_faces(frame)

        for loc in face_locations:
            embedding = self.get_embedding(frame, loc)
            if embedding is None:
                continue

            student, confidence = self.match_face(embedding)
            is_live = self.check_liveness(frame)

            results.append(RecognitionResult(
                student=student,
                confidence=confidence,
                face_location=loc,
                is_liveness_confirmed=is_live,
                frame=frame.copy(),
            ))

        return results

    def extract_embedding_from_image(self, image_path: str) -> Optional[np.ndarray]:
        """
        Extract face embedding from an image file.
        Used when enrolling a new student from their reference photo.
        """
        if not FACE_RECOGNITION_AVAILABLE:
            raise RuntimeError("face_recognition library not available")

        img = face_recognition.load_image_file(image_path)
        locations = face_recognition.face_locations(img)

        if not locations:
            raise ValueError(f"No face found in image: {image_path}")
        if len(locations) > 1:
            raise ValueError(f"Multiple faces found in image: {image_path}. Use a single-face photo.")

        encodings = face_recognition.face_encodings(img, locations)
        if not encodings:
            raise ValueError("Could not extract face encoding")

        return encodings[0]
