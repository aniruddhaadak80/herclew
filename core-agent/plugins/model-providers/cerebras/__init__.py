"""Cerebras provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

cerebras = ProviderProfile(
    name="cerebras",
    aliases=("cerebras-ai",),
    env_vars=("CEREBRAS_API_KEY",),
    base_url="https://api.cerebras.ai/v1",
    display_name="Cerebras",
    description="Cerebras — wafer-scale AI inference",
    signup_url="https://cloud.cerebras.ai/",
    fallback_models=("llama3.1-8b", "llama-3.3-70b"),
    auth_type="api_key",
)

register_provider(cerebras)
