"""
AES-256-GCM encryption/decryption for face vectors.
Must match the Node.js implementation in lib/crypto.ts
"""
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import numpy as np

IV_LENGTH = 12   # 96-bit nonce
AUTH_TAG_LENGTH = 16


def get_key(hex_key: str) -> bytes:
    """Convert 64-char hex string to 32-byte key."""
    if len(hex_key) != 64:
        raise ValueError("ENCRYPTION_KEY must be 64 hex characters (32 bytes)")
    return bytes.fromhex(hex_key)


def encrypt_face_vector(vector: np.ndarray, hex_key: str) -> bytes:
    """
    Encrypt a face embedding vector using AES-256-GCM.
    Returns: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
    """
    key = get_key(hex_key)
    aesgcm = AESGCM(key)
    iv = os.urandom(IV_LENGTH)

    # Convert float32 array to bytes
    vector_bytes = vector.astype(np.float32).tobytes()

    # AESGCM.encrypt returns ciphertext + auth_tag concatenated
    encrypted = aesgcm.encrypt(iv, vector_bytes, None)

    # Split ciphertext and auth tag
    ciphertext = encrypted[:-AUTH_TAG_LENGTH]
    auth_tag = encrypted[-AUTH_TAG_LENGTH:]

    return iv + auth_tag + ciphertext


def decrypt_face_vector(encrypted_bytes: bytes, hex_key: str) -> np.ndarray:
    """
    Decrypt an AES-256-GCM encrypted face vector.
    Expects: IV (12) + AuthTag (16) + Ciphertext
    """
    key = get_key(hex_key)
    aesgcm = AESGCM(key)

    iv = encrypted_bytes[:IV_LENGTH]
    auth_tag = encrypted_bytes[IV_LENGTH:IV_LENGTH + AUTH_TAG_LENGTH]
    ciphertext = encrypted_bytes[IV_LENGTH + AUTH_TAG_LENGTH:]

    # AESGCM.decrypt expects ciphertext + auth_tag
    decrypted = aesgcm.decrypt(iv, ciphertext + auth_tag, None)

    return np.frombuffer(decrypted, dtype=np.float32)


def decrypt_from_base64(b64_data: str, hex_key: str) -> np.ndarray:
    """Decode base64 from API response and decrypt."""
    encrypted_bytes = base64.b64decode(b64_data)
    return decrypt_face_vector(encrypted_bytes, hex_key)
