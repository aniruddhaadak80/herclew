"""DeepInfra provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

deepinfra = ProviderProfile(
    name="deepinfra",
    aliases=("deep-infra",),
    env_vars=("DEEPINFRA_API_KEY",),
    base_url="https://api.deepinfra.com/v1/openai",
    display_name="DeepInfra",
    description="DeepInfra — serverless GPU inference",
    signup_url="https://deepinfra.com/",
    fallback_models=("meta-llama/Llama-3.3-70B-Instruct", "deepseek-ai/DeepSeek-V3"),
    auth_type="api_key",
)

register_provider(deepinfra)
