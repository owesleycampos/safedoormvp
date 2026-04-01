"""
Safe Door Brasil — Face Enrollment HTTP Server
Exposes /enroll endpoint for extracting and encrypting face embeddings from photos.

Run alongside main agent:
    python enrollment_server.py

Or with custom port:
    ENROLLMENT_PORT=8001 python enrollment_server.py

Dependencies:
    pip install fastapi uvicorn python-multipart
"""
import os
import tempfile
import base64
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import structlog

from config import config
from face_engine import FaceEngine
from crypto_utils import encrypt_face_vector

logger = structlog.get_logger()

app = FastAPI(
    title="Safe Door Enrollment API",
    version="1.0.0",
    description="Internal API for enrolling student face biometrics.",
)

# Allow requests from the Next.js backend (localhost only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Lazy-initialized engine instance
_engine: FaceEngine | None = None


def get_engine() -> FaceEngine:
    global _engine
    if _engine is None:
        _engine = FaceEngine(
            encryption_key=config.encryption_key,
            min_confidence=config.min_confidence,
        )
    return _engine


@app.get("/health")
async def health():
    """Health check — confirms the enrollment service is running."""
    return {
        "status": "ok",
        "service": "safe-door-enrollment",
        "version": "1.0.0",
    }


@app.post("/enroll")
async def enroll_face(
    file: UploadFile = File(...),
    x_agent_secret: str | None = Header(None, alias="x-agent-secret"),
):
    """
    Extract and encrypt a face embedding from an uploaded photo.

    - Accepts: JPEG, PNG, WebP image (max 20MB)
    - Returns: { success, faceVectorB64, dimensions }
    - Protected by X-Agent-Secret header
    """
    # ── Authenticate ──────────────────────────────────────────────────
    expected = os.environ.get("AGENT_API_SECRET", "") or config.agent_api_secret
    if not expected or x_agent_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized — invalid or missing X-Agent-Secret")

    # ── Validate content type ─────────────────────────────────────────
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, or WebP)")

    # ── Read file ─────────────────────────────────────────────────────
    content = await file.read()

    if len(content) > 20 * 1024 * 1024:  # 20MB
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    if len(content) < 1024:  # 1KB minimum — catch empty/corrupt files
        raise HTTPException(status_code=400, detail="Image file appears to be empty or corrupt")

    # ── Write to temp file ────────────────────────────────────────────
    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    tmp_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # ── Extract embedding ─────────────────────────────────────────
        engine = get_engine()
        embedding = engine.extract_embedding_from_image(tmp_path)

        if embedding is None:
            raise HTTPException(status_code=422, detail="No face detected in the image")

        # ── Encrypt ───────────────────────────────────────────────────
        encrypted_bytes = encrypt_face_vector(embedding, config.encryption_key)
        b64 = base64.b64encode(encrypted_bytes).decode("utf-8")

        logger.info(
            "Face enrolled",
            filename=file.filename,
            dimensions=len(embedding),
            encrypted_size=len(encrypted_bytes),
        )

        return JSONResponse({
            "success": True,
            "faceVectorB64": b64,
            "dimensions": int(len(embedding)),
        })

    except ValueError as e:
        # Multiple faces, no face found, etc.
        raise HTTPException(status_code=422, detail=str(e))

    except RuntimeError as e:
        # face_recognition not installed, etc.
        raise HTTPException(status_code=503, detail=f"Face recognition engine unavailable: {e}")

    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


if __name__ == "__main__":
    port = int(os.environ.get("ENROLLMENT_PORT", 8001))
    logger.info("🛡️  Safe Door Enrollment Server", port=port, api_url=config.api_base_url)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
