"""
Safe Door Brasil — Agent Configuration
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class AgentConfig(BaseSettings):
    # API
    api_base_url: str = Field(default="http://localhost:3000", env="API_BASE_URL")
    device_api_key: str = Field(..., env="DEVICE_API_KEY")
    agent_api_secret: str = Field(..., env="AGENT_API_SECRET")

    # Encryption
    encryption_key: str = Field(..., env="ENCRYPTION_KEY")  # 64-char hex

    # Camera
    camera_index: int = Field(default=0, env="CAMERA_INDEX")
    camera_width: int = Field(default=640, env="CAMERA_WIDTH")
    camera_height: int = Field(default=480, env="CAMERA_HEIGHT")
    capture_fps: int = Field(default=10, env="CAPTURE_FPS")

    # Recognition
    min_confidence: float = Field(default=0.90, env="MIN_CONFIDENCE")
    recognition_cooldown: int = Field(default=3, env="RECOGNITION_COOLDOWN")
    vector_sync_interval: int = Field(default=300, env="VECTOR_SYNC_INTERVAL")

    # Mode
    forced_mode: Optional[str] = Field(default=None, env="FORCED_MODE")
    entry_start: str = Field(default="06:00", env="ENTRY_START")
    entry_end: str = Field(default="09:00", env="ENTRY_END")
    exit_start: str = Field(default="11:00", env="EXIT_START")
    exit_end: str = Field(default="18:00", env="EXIT_END")

    # Storage
    local_db_path: str = Field(default="./data/safedoor_local.db", env="LOCAL_DB_PATH")
    photo_cache_dir: str = Field(default="./data/photos", env="PHOTO_CACHE_DIR")

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # Enrollment server
    enrollment_port: int = Field(default=8001, env="ENROLLMENT_PORT")

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


config = AgentConfig()
