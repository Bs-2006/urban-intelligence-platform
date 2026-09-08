"""
Supabase Storage service for incident images.
- Uses SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET from .env (via app.config)
- Does NOT replace PostgreSQL (only stores path in incidents.image_key)
- Upload path: incidents/{incident_id}/{unique_filename}
"""
import uuid
import httpx
from fastapi import HTTPException

from app.config import get_settings

settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/jpg",
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _supabase_enabled() -> bool:
    return bool(settings.supabase_url and settings.supabase_key and settings.supabase_bucket)


def _validate_image(content_type: str | None, filename: str | None) -> str:
    ct = (content_type or "").lower()
    if ct and ct not in ALLOWED_CONTENT_TYPES:
        # allow any image/* but block non-image
        if not ct.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"Invalid file type '{content_type}'. Only images allowed.")
    ext = ""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        # still allow if content_type is valid image; normalize ext to jpg
        if ct in ALLOWED_CONTENT_TYPES:
            ext = ext if ext in ALLOWED_EXTENSIONS else "jpg"
        else:
            raise HTTPException(status_code=400, detail=f"Invalid file extension '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    return ext or "jpg"


def build_incident_image_key(filename: str, incident_id: int) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else "jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = "jpg"
    unique = uuid.uuid4().hex[:12]
    safe_name = f"{unique}.{ext}"
    return f"incidents/{incident_id}/{safe_name}"


def get_public_url(image_key: str) -> str | None:
    if not image_key or not _supabase_enabled():
        return None
    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_bucket
    return f"{base}/storage/v1/object/public/{bucket}/{image_key.lstrip('/')}"


async def upload_incident_image(file_bytes: bytes, filename: str, incident_id: int, content_type: str) -> str:
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB.")
    _validate_image(content_type, filename)
    image_key = build_incident_image_key(filename, incident_id)

    if not _supabase_enabled():
        # Local dev fallback: store key without remote upload; do not store binary in PG
        return image_key

    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.supabase_bucket}/{image_key}"
    headers = {
        "apikey": settings.supabase_key,
        "Authorization": f"Bearer {settings.supabase_key}",
        "Content-Type": content_type or "image/jpeg",
        "x-upsert": "true",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, content=file_bytes, headers=headers)
            if resp.status_code not in (200, 201):
                # Bucket may not exist or anon key cannot write – fallback to local key storage (dev mode)
                import logging
                logging.getLogger(__name__).warning("Supabase upload failed %s: %s – storing key locally", resp.status_code, resp.text[:300])
                return image_key
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Supabase upload exception %s – storing key locally", e)
        return image_key
    return image_key
