import os
import boto3
from urllib.parse import urlparse
import requests as req
from utils.logger import get_logger

logger = get_logger(__name__)

s3 = boto3.client(
    's3',
    region_name=os.getenv('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
)

BUCKET = os.getenv('S3_BUCKET', '')
CDN_URL = os.getenv('CDN_URL', '').rstrip('/')


def _cdn_url(key: str) -> str:
    if CDN_URL:
        return f'{CDN_URL}/{key}'
    return f'https://{BUCKET}.s3.amazonaws.com/{key}'


def upload_file(local_path: str, s3_key: str, content_type: str = 'application/octet-stream') -> str:
    logger.info('Uploading file to S3', key=s3_key)
    s3.upload_file(
        local_path,
        BUCKET,
        s3_key,
        ExtraArgs={'ContentType': content_type},
    )
    return _cdn_url(s3_key)


def upload_bytes(data: bytes, s3_key: str, content_type: str = 'application/octet-stream') -> str:
    logger.info('Uploading bytes to S3', key=s3_key, size=len(data))
    s3.put_object(Body=data, Bucket=BUCKET, Key=s3_key, ContentType=content_type)
    return _cdn_url(s3_key)


def download_file(url: str, local_path: str):
    """Download from S3 URL or any HTTP URL to local path."""
    parsed = urlparse(url)
    # If it looks like an S3 or CDN URL, try S3 SDK download first
    if CDN_URL and url.startswith(CDN_URL):
        key = url[len(CDN_URL):].lstrip('/')
        s3.download_file(BUCKET, key, local_path)
        return
    if 's3.amazonaws.com' in parsed.netloc:
        key = parsed.path.lstrip('/')
        s3.download_file(BUCKET, key, local_path)
        return

    # Fallback: HTTP download
    resp = req.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    with open(local_path, 'wb') as f:
        for chunk in resp.iter_content(chunk_size=65536):
            f.write(chunk)
