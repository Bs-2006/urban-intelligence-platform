import os

# Minimal stub for app.core.llm used by agent orchestration/planner
# If OPENAI_API_KEY is set, tries OpenAI-compatible call, otherwise falls back to deterministic stub.

async def chat_completion(messages, temperature=0.7, max_tokens=300):
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    if api_key:
        try:
            import httpx
            url = (base_url.rstrip("/") + "/chat/completions") if base_url else "https://api.openai.com/v1/chat/completions"
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens})
                if r.status_code == 200:
                    j = r.json()
                    return j["choices"][0]["message"]["content"]
        except Exception:
            pass
    # fallback - generic helpful message
    return "I can help with incidents, work orders, and employees. Try: How many incidents are there? or Show pending incidents."

async def chat_completion_json(messages, temperature=0.3, max_tokens=300):
    import json as _json
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    if api_key:
        try:
            import httpx
            url = (base_url.rstrip("/") + "/chat/completions") if base_url else "https://api.openai.com/v1/chat/completions"
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "response_format": {"type": "json_object"}})
                if r.status_code == 200:
                    j = r.json()
                    content = j["choices"][0]["message"]["content"]
                    return _json.loads(content)
        except Exception:
            pass
    # fallback - signal UNKNOWN to let planner heuristic handle
    raise RuntimeError("LLM not configured - fallback to heuristic")
