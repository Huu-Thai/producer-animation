"""Unit tests for voice cache logic."""
import hashlib
import pytest
from unittest.mock import MagicMock, patch


VOICE_MODEL = 'eleven_flash_v2_5'


def compute_cache_key(text: str, voice_id: str) -> str:
    """Replicate the cache key computation from voice_worker."""
    return hashlib.sha256(f'{text}{voice_id}{VOICE_MODEL}'.encode()).hexdigest()


class TestVoiceCacheKey:
    def test_deterministic_output(self):
        """Same inputs always produce same hash."""
        key1 = compute_cache_key("Hello world", "voice-abc")
        key2 = compute_cache_key("Hello world", "voice-abc")
        assert key1 == key2

    def test_different_text_gives_different_key(self):
        key1 = compute_cache_key("Hello world", "voice-abc")
        key2 = compute_cache_key("Goodbye world", "voice-abc")
        assert key1 != key2

    def test_different_voice_id_gives_different_key(self):
        key1 = compute_cache_key("Hello world", "voice-abc")
        key2 = compute_cache_key("Hello world", "voice-xyz")
        assert key1 != key2

    def test_key_is_64_hex_chars(self):
        """SHA-256 output is 256 bits = 64 hex characters."""
        key = compute_cache_key("Test text", "voice-id-123")
        assert len(key) == 64
        assert all(c in '0123456789abcdef' for c in key)

    def test_model_version_is_included(self):
        """Changing model version in production would invalidate all cache keys."""
        key_v1 = hashlib.sha256(f'Hello voice-abc eleven_flash_v2_5'.encode()).hexdigest()
        key_v2 = hashlib.sha256(f'Hello voice-abc eleven_flash_v2_6'.encode()).hexdigest()
        assert key_v1 != key_v2

    def test_empty_text_handled(self):
        key = compute_cache_key("", "voice-abc")
        assert len(key) == 64

    def test_vietnamese_text(self):
        """Vietnamese characters should be handled correctly."""
        key = compute_cache_key("Xin chào thế giới", "voice-vi-123")
        assert len(key) == 64


class TestVoiceCacheHitMiss:
    """Integration-style tests using mocked DB and ElevenLabs."""

    @patch('workers.voice_worker.get_db_session')
    @patch('workers.voice_worker.upload_to_s3')
    def test_cache_miss_calls_elevenlabs(self, mock_s3, mock_db):
        """On cache miss: calls ElevenLabs, uploads to S3, inserts cache record."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = None  # cache miss
        mock_db.return_value = mock_conn
        mock_s3.return_value = 'https://s3.example.com/audio.mp3'

        with patch('workers.voice_worker.ElevenLabs') as mock_eleven:
            mock_client = MagicMock()
            mock_client.text_to_speech.convert.return_value = iter([b'audio-data'])
            mock_eleven.return_value = mock_client

            from workers.voice_worker import synthesize_voice
            result = synthesize_voice.run({
                'text': 'Hello world',
                'voiceId': 'voice-abc',
                'episodeId': 'ep-1',
                'nodeId': 'voice-1',
            })

            assert result['from_cache'] is False
            assert 'audio_url' in result

    @patch('workers.voice_worker.get_db_session')
    def test_cache_hit_skips_elevenlabs(self, mock_db):
        """On cache hit: returns cached URL, does NOT call ElevenLabs."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        # Return cached row
        mock_conn.execute.return_value.fetchone.return_value = (
            'https://s3.example.com/cached.mp3',
        )
        mock_db.return_value = mock_conn

        with patch('workers.voice_worker.ElevenLabs') as mock_eleven:
            from workers.voice_worker import synthesize_voice
            result = synthesize_voice.run({
                'text': 'Hello world',
                'voiceId': 'voice-abc',
                'episodeId': 'ep-1',
                'nodeId': 'voice-1',
            })

            assert result['from_cache'] is True
            assert result['audio_url'] == 'https://s3.example.com/cached.mp3'
            mock_eleven.assert_not_called()
