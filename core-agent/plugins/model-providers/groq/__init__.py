"""Groq provider profile."""

from providers import register_provider
from providers.base import ProviderProfile

groq = ProviderProfile(
    name="groq",
    aliases=("groqcloud",),
    env_vars=("GROQ_API_KEY",),
    base_url="https://api.groq.com/openai/v1",
    display_name="Groq",
    description="Groq — ultra-fast LPU inference",
    signup_url="https://console.groq.com/",
    fallback_models=("llama-3.3-70b-versatile", "gemma2-9b-it", "deepseek-r1-distill-llama-70b"),
    auth_type="api_key",
)

register_provider(groq)
