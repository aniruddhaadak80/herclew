"""Venice AI provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

venice = ProviderProfile(
    name="venice",
    aliases=("venice-ai",),
    env_vars=("VENICE_API_KEY",),
    base_url="https://api.venice.ai/api/v1",
    display_name="Venice AI",
    description="Venice AI — private uncensored inference",
    signup_url="https://venice.ai/",
    fallback_models=("llama-3.3-70b", "hermes-3-llama-3.1-405b", "deepseek-r1-671b"),
    auth_type="api_key",
)

register_provider(venice)
