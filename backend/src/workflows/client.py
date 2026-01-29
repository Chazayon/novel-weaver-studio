"""Temporal client for workflow execution."""

from temporalio.client import Client

from ..config import settings


_client: Client | None = None


async def get_temporal_client() -> Client:
    """Get or create Temporal client."""
    global _client
    if _client is None:
        _client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace,
        )
    return _client
