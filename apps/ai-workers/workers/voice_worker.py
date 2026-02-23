import os
import uuid
import hashlib
from elevenlabs.client import ElevenLabs
from celery_app import app
from utils.s3_client import upload_bytes
from utils.db import get_voice_cache, set_voice_cache
from utils.logger import get_logger

logger = get_logger(__name__)

VOICE_MODEL = 'eleven_flash_v2_5'
client = ElevenLabs(api_key=os.getenv('ELEVENLABS_API_KEY', ''))


def compute_cache_key(text: str, voice_id: str) -> str:
    """SHA-256 hash for voice cache lookup."""
    return hashlib.sha256(f'{text}{voice_id}{VOICE_MODEL}'.encode()).hexdigest()


@app.task(name='tasks.voice.synthesize', bind=True, max_retries=3, default_retry_delay=15)
def synthesize_voice(self, text: str, voice_id: str, language: str = 'vi', **kwargs):
    """Synthesize voice using ElevenLabs with cache deduplication."""
    logger.info('Synthesizing voice', voice_id=voice_id, text_len=len(text))

    text_hash = compute_cache_key(text, voice_id)

    cached_url = get_voice_cache(voice_id, text_hash)
    if cached_url:
        logger.info('Voice cache hit', text_hash=text_hash[:16])
        return {'audio_url': cached_url, 'duration_ms': 0, 'from_cache': True}

    try:
        audio_generator = client.generate(
            text=text,
            voice=voice_id,
            model=VOICE_MODEL,
        )

        audio_bytes = b''.join(audio_generator)
        duration_ms = int(len(audio_bytes) / 32)  # rough estimate

        asset_id = str(uuid.uuid4())
        audio_url = upload_bytes(audio_bytes, f'audio/voice/{asset_id}.mp3', 'audio/mpeg')

        set_voice_cache(voice_id, text_hash, audio_url)

        logger.info('Voice synthesis complete', audio_url=audio_url, duration_ms=duration_ms)
        return {'audio_url': audio_url, 'duration_ms': duration_ms, 'from_cache': False}

    except Exception as exc:
        logger.error('Voice synthesis error', error=str(exc))
        raise self.retry(exc=exc, countdown=15)
