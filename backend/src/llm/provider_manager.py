"""Provider manager for unified LLM access."""

from typing import Dict, Any, List, Literal

from ..config import settings
from .providers.openai_provider import OpenAIProvider
from .providers.anthropic_provider import AnthropicProvider
from .providers.google_provider import GoogleProvider
from .providers.openrouter_provider import OpenRouterProvider


ProviderType = Literal["openai", "anthropic", "google", "openrouter"]


class ProviderManager:
    """Unified interface for all LLM providers."""
    
    def __init__(self):
        """Initialize provider manager with configured providers."""
        self.providers: Dict[str, Any] = {}
        
        # Initialize available providers based on API keys
        if settings.openai_api_key:
            self.providers["openai"] = OpenAIProvider(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
            )
        
        if settings.anthropic_api_key:
            self.providers["anthropic"] = AnthropicProvider(api_key=settings.anthropic_api_key)
        
        if settings.google_api_key:
            self.providers["google"] = GoogleProvider(api_key=settings.google_api_key)
        
        if settings.openrouter_api_key:
            self.providers["openrouter"] = OpenRouterProvider(api_key=settings.openrouter_api_key)
    
    def is_provider_available(self, provider: ProviderType) -> bool:
        """Check if a provider is available."""
        return provider in self.providers
    
    def get_available_providers(self) -> List[str]:
        """Get list of available provider names."""
        return list(self.providers.keys())
    
    async def generate(
        self,
        provider: ProviderType | None = None,
        model: str | None = None,
        prompt: str | None = None,
        messages: List[Dict[str, str]] | None = None,
        role: str | None = None,
        task: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
    ) -> str:
        """
        Generate text using a specific provider.
        
        Args:
            provider: Provider name ("openai", "anthropic", "google", "openrouter")
            model: Model name (provider-specific)
            prompt: Optional direct prompt
            messages: Optional message history for chat
            role: Optional system/role prompt (YAML workflow style)
            task: Optional task prompt (YAML workflow style)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text
            
        Raises:
            ValueError: If provider not available or invalid parameters
        """
        # Use default provider if not specified
        if not provider:
            provider = settings.default_llm_provider
        
        if not model:
            model = settings.default_llm_model
        
        # Try primary generation
        try:
            return await self._generate_with_provider(
                provider,
                model,
                prompt=prompt,
                messages=messages,
                role=role,
                task=task,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as e:
            # Check if backup provider is configured
            backup_provider = settings.backup_llm_provider
            backup_model = settings.backup_llm_model
            
            if not backup_provider or not backup_model:
                raise e
                
            print(f"Primary provider '{provider}' failed: {e}. Falling back to '{backup_provider}'...")
            
            try:
                return await self._generate_with_provider(
                    backup_provider,
                    backup_model,
                    prompt=prompt,
                    messages=messages,
                    role=role,
                    task=task,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except Exception as backup_error:
                raise Exception(
                    f"Both primary ({provider}) and backup ({backup_provider}) providers failed. "
                    f"Primary error: {e}. Backup error: {backup_error}"
                ) from e

    async def _generate_with_provider(
        self,
        provider: str,
        model: str,
        prompt: str | None = None,
        messages: List[Dict[str, str]] | None = None,
        role: str | None = None,
        task: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
    ) -> str:
        """Internal method to generate text with a specific provider."""
        if provider not in self.providers:
            available = self.get_available_providers()
            raise ValueError(
                f"Provider '{provider}' not available. "
                f"Available providers: {', '.join(available) if available else 'none'}"
            )
        
        # Build messages from role/task if provided (YAML workflow style)
        if role and task and not messages:
            messages = [
                {"role": "system", "content": role},
                {"role": "user", "content": task},
            ]
        
        # Get the provider instance
        provider_instance = self.providers[provider]
        
        # Special handling for Anthropic (system prompt separate)
        if provider == "anthropic" and messages and messages[0]["role"] == "system":
            system = messages[0]["content"]
            messages = messages[1:]
            return provider_instance.generate(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                system=system,
            )
        
        # OpenRouter uses async
        if provider == "openrouter":
            return await provider_instance.generate(
                model=model,
                prompt=prompt,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        
        # Standard generation for sync providers
        return provider_instance.generate(
            model=model,
            prompt=prompt,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )


# Global provider manager instance
_provider_manager: ProviderManager | None = None


def get_provider_manager() -> ProviderManager:
    """Get or create the global provider manager instance."""
    global _provider_manager
    if _provider_manager is None:
        _provider_manager = ProviderManager()
    return _provider_manager
