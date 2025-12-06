"""Lightweight config loader for the agent."""

import os
from dataclasses import dataclass
from typing import Optional


def get_neo_rpc_url() -> str:
    return os.environ.get(
        "NEO_RPC_URL",
        "https://testnet1.neo.coz.io:443",  # sensible default for development
    )


def get_xerpa_api_key() -> str | None:
    return os.environ.get("XERPA_API_KEY")


def get_aioz_api_key() -> str | None:
    return os.environ.get("AIOZ_API_KEY")


def get_elevenlabs_api_key() -> str | None:
    """Get ElevenLabs API key for voice features."""
    return os.environ.get("ELEVENLABS_API_KEY")


@dataclass
class Config:
    """Application configuration."""
    neo_rpc_url: str
    xerpa_api_key: Optional[str]
    aioz_api_key: Optional[str]
    elevenlabs_api_key: Optional[str]
    
    @classmethod
    def from_env(cls) -> "Config":
        """Load config from environment variables."""
        return cls(
            neo_rpc_url=get_neo_rpc_url(),
            xerpa_api_key=get_xerpa_api_key(),
            aioz_api_key=get_aioz_api_key(),
            elevenlabs_api_key=get_elevenlabs_api_key(),
        )


_config: Optional[Config] = None


def get_config() -> Config:
    """Get or create the global config instance."""
    global _config
    if _config is None:
        _config = Config.from_env()
    return _config


