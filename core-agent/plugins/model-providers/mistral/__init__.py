"""Mistral AI provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

mistral = ProviderProfile(
    name="mistral",
    aliases=("mistralai", "le-chat"),
    env_vars=("MISTRAL_API_KEY",),
    base_url="https://api.mistral.ai/v1",
    display_name="Mistral AI",
    description="Mistral AI — frontier European LLMs",
    signup_url="https://console.mistral.ai/",
    fallback_models=("mistral-large-latest", "codestral-latest", "mistral-small-latest"),
    auth_type="api_key",
)

register_provider(mistral)
