from typing import Protocol

from fastapi import BackgroundTasks
from google.cloud import tasks_v2
from google.protobuf import duration_pb2

from app.config import settings
from app.services.extraction_service import run_extraction


class TaskDispatcher(Protocol):
    def dispatch_extraction(self, extraction_id: str) -> None: ...


class CloudTaskDispatcher:
    def __init__(self):
        self.client = tasks_v2.CloudTasksClient()
        self.project = settings.GCP_PROJECT_ID
        self.location = settings.CLOUD_TASKS_LOCATION
        self.queue = settings.CLOUD_TASKS_EXTRACTION_QUEUE

    def dispatch_extraction(self, extraction_id: str) -> None:
        parent = self.client.queue_path(self.project, self.location, self.queue)

        task = tasks_v2.Task(
            http_request=tasks_v2.HttpRequest(
                http_method=tasks_v2.HttpMethod.POST,
                url=f"{settings.CLOUD_RUN_SERVICE_URL}/worker/extraction/{extraction_id}",
                headers={"X-API-Key": settings.API_KEY},
                oidc_token=tasks_v2.OidcToken(
                    service_account_email=settings.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL
                ),
            ),
            dispatch_deadline=duration_pb2.Duration(seconds=300),
        )

        self.client.create_task(
            request=tasks_v2.CreateTaskRequest(
                parent=parent,
                task=task,
                response_view=tasks_v2.Task.View.BASIC,
            )
        )


class LocalBackgroundDispatcher:
    def __init__(self, background_tasks: BackgroundTasks):
        self.background_tasks = background_tasks

    def dispatch_extraction(self, extraction_id: str) -> None:
        self.background_tasks.add_task(run_extraction, extraction_id)


def get_task_dispatcher(background_tasks: BackgroundTasks | None = None) -> TaskDispatcher:
    if settings.is_cloud:
        return CloudTaskDispatcher()
    if background_tasks is None:
        raise ValueError("BackgroundTasks required for local dispatcher")
    return LocalBackgroundDispatcher(background_tasks)
