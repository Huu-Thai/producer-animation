import os
import uuid
import subprocess
import tempfile
import shutil
from celery_app import app
from utils.s3_client import upload_file, download_file
from utils.logger import get_logger

logger = get_logger(__name__)


@app.task(name='tasks.render.compose', bind=True, max_retries=1, default_retry_delay=60)
def compose_render(self, scenes: list, subtitles_srt: str = None, **kwargs):
    """
    Compose final video from scenes using FFmpeg 7.
    scenes: [{ video_url, audio_url, duration }]
    """
    logger.info('Starting render', scene_count=len(scenes))
    tmp_dir = tempfile.mkdtemp(prefix='render_')

    try:
        merged_scenes = []

        for i, scene in enumerate(scenes):
            video_path = os.path.join(tmp_dir, f'scene_{i:04d}_v.mp4')
            audio_path = os.path.join(tmp_dir, f'scene_{i:04d}_a.mp3')

            logger.info('Downloading scene', index=i)
            download_file(scene['video_url'], video_path)
            download_file(scene['audio_url'], audio_path)

            # Merge audio into video clip
            merged = os.path.join(tmp_dir, f'merged_{i:04d}.mp4')
            subprocess.run(
                ['ffmpeg', '-y', '-i', video_path, '-i', audio_path,
                 '-c:v', 'copy', '-c:a', 'aac', '-shortest', merged],
                check=True, capture_output=True,
            )
            merged_scenes.append(merged)

        # Concatenate merged scenes
        concat_file = os.path.join(tmp_dir, 'concat.txt')
        with open(concat_file, 'w') as f:
            for mp in merged_scenes:
                f.write(f"file '{mp}'\n")

        raw_output = os.path.join(tmp_dir, 'output_raw.mp4')
        subprocess.run(
            ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concat_file,
             '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast', '-crf', '23',
             raw_output],
            check=True, capture_output=True,
        )

        final_path = raw_output
        if subtitles_srt:
            srt_path = os.path.join(tmp_dir, 'subtitles.srt')
            with open(srt_path, 'w', encoding='utf-8') as f:
                f.write(subtitles_srt)
            final_with_subs = os.path.join(tmp_dir, 'output_final.mp4')
            subprocess.run(
                ['ffmpeg', '-y', '-i', raw_output,
                 '-vf', f"subtitles='{srt_path}'", '-c:a', 'copy', final_with_subs],
                check=True, capture_output=True,
            )
            final_path = final_with_subs

        # Generate thumbnail at 2s
        thumbnail_path = os.path.join(tmp_dir, 'thumbnail.jpg')
        subprocess.run(
            ['ffmpeg', '-y', '-i', final_path, '-ss', '00:00:02',
             '-vframes', '1', '-q:v', '2', thumbnail_path],
            check=True, capture_output=True,
        )

        asset_id = str(uuid.uuid4())
        video_url = upload_file(final_path, f'videos/final/{asset_id}.mp4', 'video/mp4')
        thumb_url = upload_file(thumbnail_path, f'videos/thumbnails/{asset_id}.jpg', 'image/jpeg')

        logger.info('Render complete', video_url=video_url)
        return {'final_video_url': video_url, 'thumbnail_url': thumb_url}

    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode() if e.stderr else 'unknown'
        logger.error('FFmpeg error', stderr=stderr[:500])
        raise self.retry(exc=Exception(f'FFmpeg error: {stderr[:200]}'))
    except Exception as exc:
        logger.error('Render error', error=str(exc))
        raise
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.info('Cleaned up temp dir')
