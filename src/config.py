"""Lightweight config loader for the agent."""

import os


def get_neo_rpc_url() -> str:
    return os.environ.get(
        "NEO_RPC_URL",
        "https://testnet1.neo.coz.io:443",  # sensible default for development
    )


def get_xerpa_api_key() -> str | None:
    return os.environ.get("XERPA_API_KEY")


def get_aioz_api_key() -> str | None:
    return os.environ.get("AIOZ_API_KEY")


