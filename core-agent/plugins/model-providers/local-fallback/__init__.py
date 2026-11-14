"""Local fallback provider (vLLM/Ollama dynamic spin-up).

Manifest-only stub for now: the runtime spins up a vLLM/Ollama server when
internet access drops, and requests are routed through the ``custom``
endpoint profile. Registering a dedicated ProviderProfile here is deferred
until the spin-up flow lands; the manifest keeps the plugin discoverable.
"""
