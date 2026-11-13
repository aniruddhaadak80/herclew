"""llama.cpp local provider profile.

Native bindings for running GGUF-quantized models directly in memory via a
local llama.cpp server (default ``http://localhost:8080/v1``). Runs fully
offline: no API key, no health-check endpoint guarantee.
"""

from providers import register_provider
from providers.base import ProviderProfile

llama_cpp = ProviderProfile(
    name="llama-cpp",
    aliases=("llama.cpp", "llamacpp", "llama-cpp-python"),
    env_vars=(),
    base_url="http://localhost:8080/v1",
    display_name="llama.cpp",
    description="llama.cpp — local GGUF inference server (llama-server)",
    fallback_models=(),
    supports_health_check=False,
)

register_provider(llama_cpp)
