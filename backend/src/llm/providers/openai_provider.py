"""OpenAI provider implementation."""

from typing import Dict, Any, List
import openai


class OpenAIProvider:
    """OpenAI API provider for GPT models."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1"):
        """Initialize OpenAI provider."""
        self.client = openai.OpenAI(api_key=api_key, base_url=base_url)
    
    def generate(
        self,
        model: str,
        prompt: str | None = None,
        messages: List[Dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
    ) -> str:
        """
        Generate text using OpenAI API.
        
        Args:
            model: Model name (e.g., "gpt-4", "gpt-4o", "gpt-3.5-turbo")
            prompt: Optional direct prompt (converted to message)
            messages: Optional message history for chat
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text
        """
        if prompt and not messages:
            messages = [{"role": "user", "content": prompt}]
        elif not messages:
            raise ValueError("Either prompt or messages must be provided")
        
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        
        return response.choices[0].message.content
