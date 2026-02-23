import os
import time
import uuid
import requests
from openai import OpenAI
from celery_app import app
from utils.s3_client import upload_bytes
from utils.logger import get_logger

logger = get_logger(__name__)

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY', ''))


@app.task(name='tasks.motion.generate', bind=True, max_retries=2, default_retry_delay=60)
def generate_motion(
    self,
    image_url: str = None,
    motion_prompt: str = '',
    duration_seconds: int = 5,
    **kwargs,
):
    """Generate a motion clip using OpenAI Sora and upload to S3."""
    logger.info('Generating motion', prompt=motion_prompt[:60], duration=duration_seconds)

    try:
        response = client.videos.generate(
            model='sora',
            prompt=motion_prompt,
            n=1,
            size='1280x720',
            quality='standard',
        )

        video_id = response.id
        logger.info('Motion generation submitted', video_id=video_id)

        for attempt in range(90):
            time.sleep(5)
            status_resp = client.videos.retrieve(video_id)

            if status_resp.status == 'succeeded':
                video_url = status_resp.data[0].url
                vid_resp = requests.get(video_url, timeout=120)
                vid_resp.raise_for_status()

                asset_id = str(uuid.uuid4())
                cdn_url = upload_bytes(
                    vid_resp.content, f'videos/clips/{asset_id}.mp4', 'video/mp4'
                )
                logger.info('Motion generation complete', cdn_url=cdn_url)
                return {'video_url': cdn_url, 'asset_id': asset_id, 'duration_seconds': duration_seconds}

            if status_resp.status == 'failed':
                raise Exception('Sora generation failed')

            logger.info('Motion generation pending', attempt=attempt)

        raise Exception('Motion generation timed out after 7.5 minutes')

    except Exception as exc:
        logger.error('Motion generation error', error=str(exc))
        raise self.retry(exc=exc, countdown=60)
