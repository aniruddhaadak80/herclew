"""Perplexity provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

perplexity = ProviderProfile(
    name="perplexity",
    aliases=("pplx", "sonar"),
    env_vars=("PERPLEXITY_API_KEY",),
    base_url="https://api.perplexity.ai",
    display_name="Perplexity",
    description="Perplexity — search-augmented reasoning",
    signup_url="https://www.perplexity.ai/settings/api",
    fallback_models=("sonar", "sonar-pro", "sonar-reasoning"),
    auth_type="api_key",
)

register_provider(perplexity)
