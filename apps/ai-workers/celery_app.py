import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Sentry integration for error tracking
if os.getenv('SENTRY_DSN'):
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[
            CeleryIntegration(monitor_beat_tasks=True),
            LoggingIntegration(level=None, event_level='ERROR'),
        ],
        environment=os.getenv('NODE_ENV', 'development'),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )

app = Celery(
    'producer_workers',
    broker=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/1'),
    backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/2'),
    include=[
        'workers.image_worker',
        'workers.motion_worker',
        'workers.voice_worker',
        'workers.render_worker',
    ],
)

app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    result_expires=3600,
    task_routes={
        'tasks.image.generate': {'queue': 'image'},
        'tasks.motion.generate': {'queue': 'motion'},
        'tasks.voice.synthesize': {'queue': 'voice'},
        'tasks.render.compose': {'queue': 'render'},
    },
    worker_max_tasks_per_child=50,
    # Retry policy
    task_max_retries=3,
    task_default_retry_delay=5,
)

if __name__ == '__main__':
    app.start()
