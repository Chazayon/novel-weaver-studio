"""Anthropic provider implementation."""

from typing import Dict, Any, List
import anthropic


class AnthropicProvider:
    """Anthropic API provider for Claude models."""
    
    def __init__(self, api_key: str):
        """Initialize Anthropic provider."""
        self.client = anthropic.Anthropic(api_key=api_key)
    
    def generate(
        self,
        model: str,
        prompt: str | None = None,
        messages: List[Dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        system: str | None = None,
    ) -> str:
        """
        Generate text using Anthropic API.
        
        Args:
            model: Model name (e.g., "claude-3-sonnet-20240229", "claude-3-opus-20240229")
            prompt: Optional direct prompt (converted to message)
            messages: Optional message history for chat
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            system: Optional system prompt
            
        Returns:
            Generated text
        """
        if prompt and not messages:
            messages = [{"role": "user", "content": prompt}]
        elif not messages:
            raise ValueError("Either prompt or messages must be provided")
        
        # Anthropic API parameters
        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        if system:
            kwargs["system"] = system
        
        response = self.client.messages.create(**kwargs)
        
        return response.content[0].text
