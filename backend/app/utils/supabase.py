import uuid
from functools import lru_cache
import httpx
from app.config import get_settings

settings = get_settings()


def _supabase_enabled() -> bool:
    return bool(settings.supabase_url and settings.supabase_key)


def build_image_key(filename: str, incident_id: int | None = None) -> str:
    """Generate a deterministic Supabase storage key under prefix."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    uid = uuid.uuid4().hex[:8]
    prefix = settings.supabase_image_key_prefix.strip("/")
    if incident_id is not None:
        return f"{prefix}/{incident_id}/{uid}.{ext}"
    return f"{prefix}/{uid}.{ext}"


def get_public_url(image_key: str) -> str | None:
    """Return public Supabase URL for a stored key, or None if not configured."""
    if not image_key or not _supabase_enabled():
        return None
    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_bucket
    # Public bucket URL pattern
    return f"{base}/storage/v1/object/public/{bucket}/{image_key.lstrip('/')}"


async def upload_to_supabase(file_bytes: bytes, image_key: str, content_type: str = "image/jpeg") -> str:
    """
    Upload bytes to Supabase Storage and return the image_key.
    If Supabase not configured, returns the key without remote upload (local dev fallback).
    """
    if not _supabase_enabled():
        # Fallback: no remote config - just return key (caller still stores key in DB)
        return image_key

    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.supabase_bucket}/{image_key.lstrip('/')}"
    headers = {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {settings.supabase_key}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, content=file_bytes, headers=headers)
        # Supabase returns 200 on success, 409 if exists without upsert etc.
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Supabase upload failed {resp.status_code}: {resp.text}")
    return image_key


async def delete_from_supabase(image_key: str) -> None:
    if not _supabase_enabled() or not image_key:
        return
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.supabase_bucket}/{image_key.lstrip('/')}"
    headers = {"apikey": settings.supabase_key, "Authorization": f"Bearer {settings.supabase_key}"}
    async with httpx.AsyncClient() as client:
        await client.delete(url, headers=headers)
