"""Voyage AI provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

voyage = ProviderProfile(
    name="voyage",
    aliases=("voyage-ai", "voyageai"),
    env_vars=("VOYAGE_API_KEY",),
    base_url="https://api.voyageai.com/v1",
    api_mode="embeddings",
    display_name="Voyage AI",
    description="Voyage AI — state-of-the-art embeddings",
    signup_url="https://www.voyageai.com/",
    fallback_models=("voyage-3", "voyage-3-lite", "voyage-code-3"),
    auth_type="api_key",
)

register_provider(voyage)
