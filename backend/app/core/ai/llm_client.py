import time
import logging
from abc import ABC, abstractmethod
from typing import Tuple, Optional
from openai import APIConnectionError, APIStatusError
from app.config import settings
from app.core.ai.query_generator import get_cached_client, is_api_key_valid

logger = logging.getLogger("schemasay.llm_client")

class BaseLLMClient(ABC):
    @abstractmethod
    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        max_tokens: int
    ) -> Tuple[str, int, int, float, float]:
        """
        Executes completions request and returns:
        (generated_content, prompt_tokens, completion_tokens, estimated_cost_usd, execution_time_ms)
        """
        pass

class OpenAILLMClient(BaseLLMClient):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        max_tokens: int
    ) -> Tuple[str, int, int, float, float]:
        client = get_cached_client(api_key=self.api_key)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        max_retries = 3
        base_delay = 1.0
        start_time = time.perf_counter()

        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=temperature,
                    timeout=timeout,
                    max_tokens=max_tokens
                )
                duration_ms = (time.perf_counter() - start_time) * 1000.0
                
                content = response.choices[0].message.content.strip()
                prompt_tokens = response.usage.prompt_tokens if response.usage else 0
                completion_tokens = response.usage.completion_tokens if response.usage else 0
                
                # Estimated cost: $0.150/1M input tokens, $0.600/1M output tokens (verify current pricing at platform.openai.com)
                cost = (prompt_tokens * 0.15 / 1_000_000) + (completion_tokens * 0.60 / 1_000_000)
                
                return content, prompt_tokens, completion_tokens, cost, duration_ms
            except APIStatusError as e:
                if e.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"OpenAI transient status error {e.status_code}. Retrying in {delay:.2f}s...")
                    time.sleep(delay)
                    continue
                raise e
            except APIConnectionError as e:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"OpenAI transient connection error. Retrying in {delay:.2f}s...")
                    time.sleep(delay)
                    continue
                raise e
            except Exception as e:
                raise e

class GeminiLLMClient(BaseLLMClient):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        max_tokens: int
    ) -> Tuple[str, int, int, float, float]:
        client = get_cached_client(
            api_key=self.api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        max_retries = 3
        base_delay = 1.0
        start_time = time.perf_counter()

        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model="gemini-1.5-flash",
                    messages=messages,
                    temperature=temperature,
                    timeout=timeout,
                    max_tokens=max_tokens
                )
                duration_ms = (time.perf_counter() - start_time) * 1000.0
                
                content = response.choices[0].message.content.strip()
                prompt_tokens = response.usage.prompt_tokens if response.usage else 0
                completion_tokens = response.usage.completion_tokens if response.usage else 0
                
                # Estimated cost: $0.075/1M input tokens, $0.300/1M output tokens (verify current pricing at ai.google.dev)
                cost = (prompt_tokens * 0.075 / 1_000_000) + (completion_tokens * 0.30 / 1_000_000)
                
                return content, prompt_tokens, completion_tokens, cost, duration_ms
            except APIStatusError as e:
                if e.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"Gemini transient status error {e.status_code}. Retrying in {delay:.2f}s...")
                    time.sleep(delay)
                    continue
                raise e
            except APIConnectionError as e:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"Gemini transient connection error. Retrying in {delay:.2f}s...")
                    time.sleep(delay)
                    continue
                raise e
            except Exception as e:
                raise e

def get_llm_client() -> Optional[BaseLLMClient]:
    """
    Returns the appropriate LLM client based on available API keys.
    Checks the INSIGHT_PROVIDER environment variable first, then defaults to Gemini, then OpenAI.
    Returns None if no valid API key is configured.
    """
    # Check for configuration override from environment variables if present
    import os
    preferred_provider = os.environ.get("INSIGHT_PROVIDER", "").strip().lower()
    
    gemini_active = is_api_key_valid(settings.GEMINI_API_KEY)
    openai_active = is_api_key_valid(settings.OPENAI_API_KEY)

    if preferred_provider == "gemini" and gemini_active:
        return GeminiLLMClient(settings.GEMINI_API_KEY)
    elif preferred_provider == "openai" and openai_active:
        return OpenAILLMClient(settings.OPENAI_API_KEY)
        
    # Default priority: Gemini first, then OpenAI
    if gemini_active:
        return GeminiLLMClient(settings.GEMINI_API_KEY)
    elif openai_active:
        return OpenAILLMClient(settings.OPENAI_API_KEY)
        
    return None
