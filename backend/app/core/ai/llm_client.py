import os
import time
import logging
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple

from openai import OpenAI, APIConnectionError, APIStatusError

from app.config import settings

logger = logging.getLogger("schemasay.llm_client")

_llm_clients: Dict[tuple, OpenAI] = {}
_client_lock = threading.Lock()

_GEMINI_FALLBACK_MODELS = (
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
)


def get_cached_client(api_key: str, base_url: Optional[str] = None) -> OpenAI:
    """
    Retrieves a cached OpenAI client registry instance or instantiates one securely.
    Reusable socket pools reduce latency.
    """
    cache_key = (api_key, base_url)
    if cache_key in _llm_clients:
        return _llm_clients[cache_key]

    with _client_lock:
        if cache_key not in _llm_clients:
            if base_url:
                _llm_clients[cache_key] = OpenAI(api_key=api_key, base_url=base_url)
            else:
                _llm_clients[cache_key] = OpenAI(api_key=api_key)
        return _llm_clients[cache_key]


def is_api_key_valid(key: Optional[str]) -> bool:
    """
    Validates that a configured third-party API key exists and is not
    a default placeholder string.
    """
    if not key:
        return False
    sanitized = key.strip().lower()
    placeholders = {
        "",
        "none",
        "null",
        "placeholder",
        "your-openai-key-here",
        "your-gemini-key-here",
        "your_openai_key",
        "your_gemini_key",
        "your-openai-api-key-here",
        "your-gemini-api-key-here",
    }
    return sanitized not in placeholders


def preferred_llm_provider() -> str:
    env_override = os.environ.get("INSIGHT_PROVIDER", "").strip().lower()
    if env_override:
        return env_override
    return (settings.LLM_PROVIDER or "auto").strip().lower()


def gemini_model_candidates() -> List[str]:
    ordered: List[str] = []
    for model in (settings.GEMINI_MODEL, *_GEMINI_FALLBACK_MODELS):
        if model and model not in ordered:
            ordered.append(model)
    return ordered


@dataclass
class LLMCompletion:
    content: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    duration_ms: float
    provider: str
    model: str


class BaseLLMClient(ABC):
    provider: str = "unknown"
    model: str = ""

    @abstractmethod
    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        max_tokens: int,
    ) -> Tuple[str, int, int, float, float]:
        """
        Executes completions request and returns:
        (generated_content, prompt_tokens, completion_tokens, estimated_cost_usd, execution_time_ms)
        """
        pass


def _run_chat_completion(
    client: OpenAI,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    timeout: float,
    max_tokens: int,
    input_cost_per_million: float,
    output_cost_per_million: float,
) -> Tuple[str, int, int, float, float]:
    start_time = time.perf_counter()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        timeout=timeout,
        max_tokens=max_tokens,
    )
    duration_ms = (time.perf_counter() - start_time) * 1000.0
    content = (response.choices[0].message.content or "").strip()
    prompt_tokens = response.usage.prompt_tokens if response.usage else 0
    completion_tokens = response.usage.completion_tokens if response.usage else 0
    cost = (prompt_tokens * input_cost_per_million / 1_000_000) + (
        completion_tokens * output_cost_per_million / 1_000_000
    )
    return content, prompt_tokens, completion_tokens, cost, duration_ms


def _retryable_status(status_code: int) -> bool:
    return status_code in (429, 500, 502, 503, 504)


class OpenAILLMClient(BaseLLMClient):
    provider = "openai"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = settings.OPENAI_MODEL

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        max_tokens: int,
    ) -> Tuple[str, int, int, float, float]:
        client = get_cached_client(api_key=self.api_key)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        max_retries = 3
        base_delay = 1.0

        for attempt in range(max_retries):
            try:
                return _run_chat_completion(
                    client=client,
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    timeout=timeout,
                    max_tokens=max_tokens,
                    input_cost_per_million=0.15,
                    output_cost_per_million=0.60,
                )
            except APIStatusError as e:
                if _retryable_status(e.status_code) and attempt < max_retries - 1:
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


class GeminiLLMClient(BaseLLMClient):
    provider = "gemini"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = settings.GEMINI_MODEL

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        max_tokens: int,
    ) -> Tuple[str, int, int, float, float]:
        client = get_cached_client(
            api_key=self.api_key,
            base_url=settings.GEMINI_BASE_URL,
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        max_retries = 3
        base_delay = 1.0
        models = gemini_model_candidates()
        last_error: Optional[Exception] = None

        for model_index, model in enumerate(models):
            for attempt in range(max_retries):
                try:
                    result = _run_chat_completion(
                        client=client,
                        model=model,
                        messages=messages,
                        temperature=temperature,
                        timeout=timeout,
                        max_tokens=max_tokens,
                        input_cost_per_million=0.075,
                        output_cost_per_million=0.30,
                    )
                    self.model = model
                    return result
                except APIStatusError as e:
                    last_error = e
                    if e.status_code == 404 and model_index < len(models) - 1:
                        logger.warning(
                            "Gemini model %s is unavailable. Trying fallback model %s.",
                            model,
                            models[model_index + 1],
                        )
                        break
                    if _retryable_status(e.status_code) and attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        logger.warning(
                            f"Gemini transient status error {e.status_code}. Retrying in {delay:.2f}s..."
                        )
                        time.sleep(delay)
                        continue
                    raise e
                except APIConnectionError as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        logger.warning(f"Gemini transient connection error. Retrying in {delay:.2f}s...")
                        time.sleep(delay)
                        continue
                    raise e

        if last_error:
            raise last_error
        raise RuntimeError("Gemini completion failed without a provider error.")


def list_llm_clients() -> List[BaseLLMClient]:
    """
    Returns configured LLM clients in preference order.
    Default (auto): Gemini first, then OpenAI.
    """
    gemini_active = is_api_key_valid(settings.GEMINI_API_KEY)
    openai_active = is_api_key_valid(settings.OPENAI_API_KEY)
    preferred = preferred_llm_provider()

    ordered: List[BaseLLMClient] = []

    def add_gemini() -> None:
        if gemini_active:
            ordered.append(GeminiLLMClient(settings.GEMINI_API_KEY))

    def add_openai() -> None:
        if openai_active:
            ordered.append(OpenAILLMClient(settings.OPENAI_API_KEY))

    if preferred == "openai":
        add_openai()
        add_gemini()
    else:
        add_gemini()
        add_openai()

    return ordered


def get_llm_client() -> Optional[BaseLLMClient]:
    """
    Returns the preferred LLM client based on available API keys.
    Checks INSIGHT_PROVIDER / LLM_PROVIDER, then defaults to Gemini, then OpenAI.
    Returns None if no valid API key is configured.
    """
    clients = list_llm_clients()
    return clients[0] if clients else None


def complete_chat_with_fallback(
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    timeout: float,
    max_tokens: int,
) -> LLMCompletion:
    """
    Tries each configured provider in order until one returns non-empty content.
    """
    clients = list_llm_clients()
    if not clients:
        raise RuntimeError("No LLM provider is configured.")

    last_error: Optional[Exception] = None
    for client in clients:
        try:
            content, prompt_tokens, completion_tokens, cost, duration = client.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                timeout=timeout,
                max_tokens=max_tokens,
            )
            if not content:
                last_error = RuntimeError(f"{client.provider} returned empty content.")
                logger.warning("%s", last_error)
                continue
            return LLMCompletion(
                content=content,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_usd=cost,
                duration_ms=duration,
                provider=client.provider,
                model=client.model,
            )
        except Exception as exc:
            last_error = exc
            logger.warning(
                "LLM provider %s failed (%s); trying next configured provider if available.",
                client.provider,
                type(exc).__name__,
            )
            continue

    raise last_error or RuntimeError("All configured LLM providers failed.")
