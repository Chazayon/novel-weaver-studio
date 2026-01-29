"""OpenRouter provider implementation."""

from typing import Dict, Any, List
import httpx


class OpenRouterProvider:
    """OpenRouter API provider for multiple LLM models."""
    
    def __init__(self, api_key: str):
        """Initialize OpenRouter provider."""
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
    
    async def generate(
        self,
        model: str,
        prompt: str | None = None,
        messages: List[Dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
    ) -> str:
        """
        Generate text using OpenRouter API.
        
        OpenRouter provides access to multiple models:
        - google/gemini-pro
        - anthropic/claude-3-sonnet
        - openai/gpt-4
        - meta-llama/llama-3-70b
        - And many more!
        
        Args:
            model: Model name (e.g., "google/gemini-pro", "anthropic/claude-3-sonnet")
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
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://novel-weaver-studio.app",
                    "X-Title": "Novel Weaver Studio",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
