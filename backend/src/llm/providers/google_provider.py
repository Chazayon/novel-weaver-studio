"""Google Generative AI provider implementation."""

from typing import Dict, Any, List
import google.generativeai as genai


class GoogleProvider:
    """Google Generative AI provider for Gemini models."""
    
    def __init__(self, api_key: str):
        """Initialize Google provider."""
        genai.configure(api_key=api_key)
    
    def generate(
        self,
        model: str,
        prompt: str | None = None,
        messages: List[Dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
    ) -> str:
        """
        Generate text using Google Generative AI API.
        
        Args:
            model: Model name (e.g., "gemini-pro", "gemini-2.5-pro", "gemini-2.0-flash-exp")
            prompt: Optional direct prompt
            messages: Optional message history for chat
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text
        """
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        
        model_instance = genai.GenerativeModel(
            model_name=model,
            generation_config=generation_config,
        )
        
        # Convert messages to prompt if needed
        if messages and not prompt:
            # Combine messages into a single prompt
            prompt_parts = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    prompt_parts.append(f"Instructions: {content}")
                elif role == "user":
                    prompt_parts.append(f"User: {content}")
                elif role == "assistant":
                    prompt_parts.append(f"Assistant: {content}")
            prompt = "\n\n".join(prompt_parts)
        
        if not prompt:
            raise ValueError("Either prompt or messages must be provided")
        
        # Use simple prompt-based generation
        response = model_instance.generate_content(prompt)
        
        return response.text
