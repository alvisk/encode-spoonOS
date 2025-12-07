"""Shared dependencies for the AlgoBoost API layer."""

from __future__ import annotations

import logging
from functools import lru_cache

from src.agent import build_agent

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_agent():
    """Shared agent instance for routes that need it."""
    try:
        return build_agent()
    except Exception as exc:  # pragma: no cover - initialization guard
        logger.exception("Failed to build agent: %s", exc)
        raise






