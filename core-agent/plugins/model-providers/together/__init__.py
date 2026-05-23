"""Together AI provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

together = ProviderProfile(
    name="together",
    aliases=("together-ai", "togetherai"),
    env_vars=("TOGETHER_API_KEY",),
    base_url="https://api.together.xyz/v1",
    display_name="Together AI",
    description="Together AI — open-source model hosting",
    signup_url="https://api.together.xyz/",
    fallback_models=(
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "Qwen/Qwen2.5-72B-Instruct-Turbo",
        "deepseek-ai/DeepSeek-V3",
    ),
    auth_type="api_key",
)

register_provider(together)
