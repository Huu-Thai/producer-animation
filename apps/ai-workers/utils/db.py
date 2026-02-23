import os
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from utils.logger import get_logger

logger = get_logger(__name__)

_db_url = os.getenv('DATABASE_URL', '').replace('postgresql://', 'postgresql+psycopg2://')
engine = create_engine(_db_url, poolclass=NullPool)


def get_voice_cache(voice_id: str, text_hash: str):
    """Return cached audio_url or None."""
    with engine.connect() as conn:
        row = conn.execute(
            text('SELECT audio_url FROM voice_cache WHERE voice_id = :vid AND text_hash = :th'),
            {'vid': voice_id, 'th': text_hash},
        ).fetchone()
    return row[0] if row else None


def set_voice_cache(voice_id: str, text_hash: str, audio_url: str):
    """Store voice synthesis result, ignore duplicates."""
    with engine.connect() as conn:
        conn.execute(
            text('''
                INSERT INTO voice_cache (id, voice_id, text_hash, audio_url)
                VALUES (gen_random_uuid(), :vid, :th, :url)
                ON CONFLICT (voice_id, text_hash) DO NOTHING
            '''),
            {'vid': voice_id, 'th': text_hash, 'url': audio_url},
        )
        conn.commit()
    logger.info('Voice cache stored', voice_id=voice_id)
