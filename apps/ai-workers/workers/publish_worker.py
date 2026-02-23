"""
YouTube publish worker with resumable upload (YouTube Data API v3).
Decrypts OAuth tokens from DB, handles token refresh, and uploads with
progress tracking reported back via internal webhook.
"""
import os
import json
import time
import requests
import structlog
from celery_app import app
from utils.db import get_db_session
from utils.logger import get_logger
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64

logger = get_logger('publish_worker')

YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos'
YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'
CHUNK_SIZE = 10 * 1024 * 1024  # 10MB chunks
INTERNAL_SECRET = os.getenv('INTERNAL_SECRET', '')
WORKFLOW_ENGINE_URL = os.getenv('WORKFLOW_ENGINE_URL', 'http://localhost:3002')


def decrypt_config(encrypted_json: str) -> dict:
    """Decrypt AES-256-GCM channel config stored in DB."""
    key_hex = os.getenv('ENCRYPTION_KEY', '0' * 64)
    key = bytes.fromhex(key_hex)
    data = json.loads(encrypted_json)
    iv = bytes.fromhex(data['iv'])
    tag = bytes.fromhex(data['tag'])
    ciphertext = bytes.fromhex(data['encrypted']) + tag
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, ciphertext, None)
    return json.loads(decrypted)


def refresh_access_token(refresh_token: str) -> str:
    """Refresh YouTube OAuth access token."""
    resp = requests.post(YOUTUBE_TOKEN_URL, data={
        'client_id': os.getenv('YOUTUBE_CLIENT_ID'),
        'client_secret': os.getenv('YOUTUBE_CLIENT_SECRET'),
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token',
    })
    resp.raise_for_status()
    return resp.json()['access_token']


def report_progress(episode_id: str, progress_pct: int):
    """Send upload progress to workflow engine → WebSocket."""
    try:
        requests.post(
            f'{WORKFLOW_ENGINE_URL}/internal/episode/upload-progress',
            json={'episodeId': episode_id, 'progressPct': progress_pct},
            headers={'x-internal-secret': INTERNAL_SECRET},
            timeout=5,
        )
    except Exception:
        pass  # non-critical


def resumable_upload(
    video_url: str,
    access_token: str,
    title: str,
    description: str,
    episode_id: str,
) -> str:
    """
    Perform a YouTube resumable upload in chunks.
    Returns the platform video ID on success.
    """
    # Download video to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
        tmp_path = tmp.name
        with requests.get(video_url, stream=True) as r:
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
                tmp.write(chunk)

    file_size = os.path.getsize(tmp_path)

    # Initiate resumable upload session
    init_resp = requests.post(
        f'{YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/mp4',
            'X-Upload-Content-Length': str(file_size),
        },
        json={
            'snippet': {
                'title': title[:100],
                'description': description[:5000],
                'categoryId': '24',  # Entertainment
            },
            'status': {
                'privacyStatus': 'private',  # Start private, make public after confirmation
                'selfDeclaredMadeForKids': False,
            },
        },
    )
    init_resp.raise_for_status()
    upload_url = init_resp.headers['Location']

    # Upload in chunks
    uploaded = 0
    platform_video_id = None

    with open(tmp_path, 'rb') as f:
        while uploaded < file_size:
            chunk = f.read(CHUNK_SIZE)
            end = uploaded + len(chunk) - 1

            upload_resp = requests.put(
                upload_url,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Range': f'bytes {uploaded}-{end}/{file_size}',
                    'Content-Type': 'video/mp4',
                },
                data=chunk,
            )

            if upload_resp.status_code in (200, 201):
                platform_video_id = upload_resp.json()['id']
                report_progress(episode_id, 100)
                break
            elif upload_resp.status_code == 308:
                # Incomplete, continue
                uploaded = end + 1
                pct = int(uploaded / file_size * 100)
                report_progress(episode_id, pct)
            else:
                upload_resp.raise_for_status()

    os.unlink(tmp_path)

    if not platform_video_id:
        raise RuntimeError('Upload completed but no video ID returned')

    return platform_video_id


@app.task(
    name='tasks.publish.youtube',
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def publish_to_youtube(self, payload: dict) -> dict:
    """
    Publish rendered episode to YouTube.
    payload: {
      episodeId, channelId, videoUrl, title, description, thumbnailUrl?
    }
    """
    episode_id = payload['episodeId']
    channel_id = payload['channelId']
    video_url = payload['videoUrl']
    title = payload.get('title', 'Untitled Episode')
    description = payload.get('description', '')

    logger.info('Starting YouTube publish', episode_id=episode_id, channel_id=channel_id)

    with get_db_session() as db:
        row = db.execute(
            'SELECT config FROM channels WHERE id = %s',
            (channel_id,)
        ).fetchone()

        if not row:
            raise ValueError(f'Channel {channel_id} not found')

        config = decrypt_config(row[0]) if isinstance(row[0], str) else row[0]

    try:
        access_token = refresh_access_token(config['refreshToken'])
    except Exception as e:
        raise self.retry(exc=e, countdown=30)

    try:
        platform_video_id = resumable_upload(
            video_url=video_url,
            access_token=access_token,
            title=title,
            description=description,
            episode_id=episode_id,
        )
    except Exception as e:
        logger.error('Upload failed', episode_id=episode_id, error=str(e))
        raise self.retry(exc=e, countdown=60)

    logger.info('Published successfully', episode_id=episode_id, video_id=platform_video_id)

    return {
        'platformVideoId': platform_video_id,
        'videoUrl': f'https://www.youtube.com/watch?v={platform_video_id}',
        'channelId': channel_id,
    }
