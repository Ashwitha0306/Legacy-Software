"""
LLM Client Wrapper — Multi-Provider Support

Connects to:
1. Google Gemini (GEMINI_API_KEY / GOOGLE_API_KEY)
2. OpenAI (OPENAI_API_KEY)
3. Groq (GROQ_API_KEY)
4. Anthropic Claude (ANTHROPIC_API_KEY)
5. Local Ollama (OLLAMA_BASE_URL)
6. Offline Grounded Dynamic AST Synthesizer (when zero API keys are set)
"""

from __future__ import annotations

import os
import json
import httpx
from typing import Any, Dict, List, Optional
from core.config import settings
from core.logger import get_logger
from llm.prompts import SYSTEM_RECONSTRUCTION_PROMPT, USER_RECONSTRUCTION_PROMPT

logger = get_logger(__name__)


async def call_openai(prompt: str, system_prompt: str, api_key: str, model: str = "gpt-4o-mini") -> Optional[str]:
    """Call OpenAI Chat Completions API."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
            else:
                logger.warning("OpenAI API call returned error", status=res.status_code, body=res.text[:200])
    except Exception as exc:
        logger.warning("OpenAI call failed", error=str(exc))
    return None


async def call_gemini(prompt: str, system_prompt: str, api_key: str, model: str = "gemini-1.5-flash") -> Optional[str]:
    """Call Google Gemini REST API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    full_prompt = f"{system_prompt}\n\nUser Question:\n{prompt}"
    payload = {
        "contents": [
            {
                "parts": [{"text": full_prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
            else:
                logger.warning("Gemini API call returned error", status=res.status_code, body=res.text[:200])
    except Exception as exc:
        logger.warning("Gemini call failed", error=str(exc))
    return None


async def call_groq(prompt: str, system_prompt: str, api_key: str, model: str = "llama-3.3-70b-versatile") -> Optional[str]:
    """Call Groq Cloud API."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
            else:
                logger.warning("Groq API call returned error", status=res.status_code, body=res.text[:200])
    except Exception as exc:
        logger.warning("Groq call failed", error=str(exc))
    return None


async def call_anthropic(prompt: str, system_prompt: str, api_key: str, model: str = "claude-3-5-sonnet-20241022") -> Optional[str]:
    """Call Anthropic Claude API."""
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "system": system_prompt,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048,
        "temperature": 0.2,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data.get("content", [])
                if content:
                    return content[0].get("text", "")
            else:
                logger.warning("Anthropic API call returned error", status=res.status_code, body=res.text[:200])
    except Exception as exc:
        logger.warning("Anthropic call failed", error=str(exc))
    return None


async def call_ollama(prompt: str, system_prompt: str, base_url: str, model: str = "llama3") -> Optional[str]:
    """Call local Ollama server."""
    url = f"{base_url.rstrip('/')}/api/generate"
    full_prompt = f"{system_prompt}\n\n{prompt}"
    payload = {
        "model": model,
        "prompt": full_prompt,
        "stream": False,
        "options": {"temperature": 0.2},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                text = data.get("response", "")
                if text.strip():
                    return text
    except Exception:
        pass
    return None


async def query_llm(
    prompt: str,
    system_prompt: str,
    api_key: Optional[str] = None,
    provider: Optional[str] = None,
) -> Optional[str]:
    """
    Intelligent multi-provider LLM dispatcher.
    Checks explicit request key (with auto-detection for provider='auto'),
    then environment variables, then local Ollama.
    """
    key = api_key.strip() if api_key and isinstance(api_key, str) else None
    prov = (provider or "auto").lower().strip()

    # If an API key is provided, resolve provider if 'auto'
    if key:
        if prov == "gemini" or (prov == "auto" and key.startswith("AIzaSy")):
            ans = await call_gemini(prompt, system_prompt, key, settings.GEMINI_MODEL)
            if ans:
                logger.info("LLM query answered via Gemini (user key)")
                return ans

        if prov == "openai" or (prov == "auto" and (key.startswith("sk-proj-") or key.startswith("sk-"))):
            ans = await call_openai(prompt, system_prompt, key, settings.OPENAI_MODEL)
            if ans:
                logger.info("LLM query answered via OpenAI (user key)")
                return ans

        if prov == "groq" or (prov == "auto" and key.startswith("gsk_")):
            ans = await call_groq(prompt, system_prompt, key, settings.GROQ_MODEL)
            if ans:
                logger.info("LLM query answered via Groq (user key)")
                return ans

        if prov == "anthropic" or (prov == "auto" and key.startswith("sk-ant-")):
            ans = await call_anthropic(prompt, system_prompt, key, settings.ANTHROPIC_MODEL)
            if ans:
                logger.info("LLM query answered via Anthropic (user key)")
                return ans

        # Fallback for provider="auto" with unrecognized key pattern: try providers in sequence
        if prov == "auto":
            for try_fn, model_name, prov_label in [
                (call_gemini, settings.GEMINI_MODEL, "Gemini"),
                (call_openai, settings.OPENAI_MODEL, "OpenAI"),
                (call_groq, settings.GROQ_MODEL, "Groq"),
            ]:
                ans = await try_fn(prompt, system_prompt, key, model_name)
                if ans:
                    logger.info(f"LLM query answered via {prov_label} (auto-fallback user key)")
                    return ans

    # Fallback to Environment Variables
    env_gemini = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if env_gemini:
        ans = await call_gemini(prompt, system_prompt, env_gemini, settings.GEMINI_MODEL)
        if ans:
            logger.info("LLM query answered via Gemini (env key)")
            return ans

    env_openai = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
    if env_openai:
        ans = await call_openai(prompt, system_prompt, env_openai, settings.OPENAI_MODEL)
        if ans:
            logger.info("LLM query answered via OpenAI (env key)")
            return ans

    env_groq = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    if env_groq:
        ans = await call_groq(prompt, system_prompt, env_groq, settings.GROQ_MODEL)
        if ans:
            logger.info("LLM query answered via Groq (env key)")
            return ans

    env_anthropic = settings.ANTHROPIC_API_KEY or os.environ.get("ANTHROPIC_API_KEY")
    if env_anthropic:
        ans = await call_anthropic(prompt, system_prompt, env_anthropic, settings.ANTHROPIC_MODEL)
        if ans:
            logger.info("LLM query answered via Anthropic (env key)")
            return ans

    # Local Ollama fallback
    ollama_ans = await call_ollama(prompt, system_prompt, settings.OLLAMA_BASE_URL, settings.OLLAMA_MODEL)
    if ollama_ans:
        logger.info("LLM query answered via local Ollama", model=settings.OLLAMA_MODEL)
        return ollama_ans

    return None



async def generate_grounded_reconstruction(
    sskg_context_text: str, task_description: str = "Generate system architecture & API docs"
) -> str:
    """Grounded architecture reconstruction with LLM fallback."""
    sys_prompt = SYSTEM_RECONSTRUCTION_PROMPT.format(sskg_context=sskg_context_text)
    user_prompt = USER_RECONSTRUCTION_PROMPT.format(task_description=task_description)

    llm_output = await query_llm(user_prompt, sys_prompt)
    if llm_output and len(llm_output.strip()) > 50:
        return llm_output

    return f"Grounded Software Architecture Summary:\n{sskg_context_text}"
