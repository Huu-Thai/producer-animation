import os
import time
import uuid
import requests
from celery_app import app
from utils.s3_client import upload_bytes
from utils.logger import get_logger

logger = get_logger(__name__)

LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1'
LEONARDO_API_KEY = os.getenv('LEONARDO_API_KEY', '')


@app.task(name='tasks.image.generate', bind=True, max_retries=3, default_retry_delay=30)
def generate_image(
    self,
    prompt: str,
    style: str = None,
    character_refs: list = None,
    width: int = 1280,
    height: int = 720,
    lora_id: str = None,
    **kwargs,
):
    """Generate an image using Leonardo.ai and upload to S3."""
    logger.info('Generating image', prompt=prompt[:60], style=style)

    headers = {
        'Authorization': f'Bearer {LEONARDO_API_KEY}',
        'Content-Type': 'application/json',
    }

    payload = {
        'prompt': prompt,
        'width': width,
        'height': height,
        'num_images': 1,
        'guidance_scale': 7,
        'num_inference_steps': 30,
    }
    if style:
        payload['presetStyle'] = style
    if lora_id:
        payload['userElements'] = [{'userLoraId': lora_id, 'weight': 0.75}]

    try:
        resp = requests.post(
            f'{LEONARDO_API_BASE}/generations',
            json=payload,
            headers=headers,
            timeout=30,
        )
        if resp.status_code == 429:
            raise self.retry(countdown=60, exc=Exception('Leonardo rate limited'))
        resp.raise_for_status()

        generation_id = resp.json()['sdGenerationJob']['generationId']
        logger.info('Image generation submitted', generation_id=generation_id)

        for _ in range(60):
            time.sleep(5)
            poll = requests.get(
                f'{LEONARDO_API_BASE}/generations/{generation_id}',
                headers=headers,
                timeout=15,
            )
            poll.raise_for_status()
            data = poll.json()['generations_by_pk']

            if data['status'] == 'COMPLETE':
                image_url = data['generated_images'][0]['url']
                img_resp = requests.get(image_url, timeout=60)
                img_resp.raise_for_status()

                asset_id = str(uuid.uuid4())
                cdn_url = upload_bytes(img_resp.content, f'images/{asset_id}.jpg', 'image/jpeg')
                logger.info('Image generation complete', cdn_url=cdn_url)
                return {'image_url': cdn_url, 'asset_id': asset_id}

            if data['status'] == 'FAILED':
                raise Exception('Leonardo generation failed')

        raise Exception('Image generation timed out')

    except Exception as exc:
        logger.error('Image generation error', error=str(exc))
        raise self.retry(exc=exc, countdown=30)
