"""LiteLLM Proxy provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

litellm = ProviderProfile(
    name="litellm",
    aliases=("lite-llm", "litellm-proxy"),
    env_vars=("LITELLM_API_KEY",),
    base_url="http://localhost:4000/v1",
    display_name="LiteLLM Proxy",
    description="LiteLLM — unified proxy for 100+ LLM providers",
    signup_url="https://docs.litellm.ai/",
    fallback_models=("gpt-4o", "claude-sonnet-4-20250514"),
    supports_health_check=False,
    auth_type="api_key",
)

register_provider(litellm)
