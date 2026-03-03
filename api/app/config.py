import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "local")

    ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

    FIREBASE_STORAGE_BUCKET: str = os.getenv("FIREBASE_STORAGE_BUCKET", "")
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        "./dev-firebase-adminsdk-service-account.json",
    )

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    LANGSMITH_API_KEY: str = os.getenv("LANGSMITH_API_KEY", "")
    LANGSMITH_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "default")
    LANGSMITH_ENDPOINT: str = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")

    API_KEY: str = os.getenv("API_KEY", "")

    GCP_PROJECT_ID: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")

    CLOUD_TASKS_LOCATION: str = os.getenv("CLOUD_TASKS_LOCATION", "europe-west1")
    CLOUD_RUN_SERVICE_URL: str = os.getenv("CLOUD_RUN_SERVICE_URL", "")
    CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL: str = os.getenv("CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL", "")
    CLOUD_TASKS_EXTRACTION_QUEUE: str = os.getenv(
        "CLOUD_TASKS_EXTRACTION_QUEUE", "extraction-queue"
    )

    def __init__(self):
        self._validate()

    def _validate(self):
        if not self.FIREBASE_STORAGE_BUCKET:
            raise ValueError(
                "FIREBASE_STORAGE_BUCKET is required. "
                "Set it in .env (local) or Cloud Run environment variables."
            )

        if self.is_local:
            if not self.FIREBASE_SERVICE_ACCOUNT_PATH:
                raise ValueError("FIREBASE_SERVICE_ACCOUNT_PATH is required for local development")
            if not os.path.exists(self.FIREBASE_SERVICE_ACCOUNT_PATH):
                raise ValueError(
                    f"Service account file not found: {self.FIREBASE_SERVICE_ACCOUNT_PATH}"
                )

        if not self.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required. Set it in .env or environment variables.")

        if not self.LANGSMITH_API_KEY:
            raise ValueError(
                "LANGSMITH_API_KEY is required. Set it in .env or environment variables."
            )

        if self.is_cloud:
            if not self.API_KEY:
                raise ValueError(
                    "API_KEY is required when running in cloud environment. "
                    "Set it in Cloud Run environment variables."
                )
            if not self.CLOUD_RUN_SERVICE_URL:
                raise ValueError(
                    "CLOUD_RUN_SERVICE_URL is required when running in cloud environment. "
                    "Set it in Cloud Run environment variables."
                )
            if not self.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
                raise ValueError(
                    "CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL is required when running in cloud environment. "
                    "Set it in Cloud Run environment variables."
                )

    @property
    def is_local(self) -> bool:
        return self.ENVIRONMENT == "local"

    @property
    def is_cloud(self) -> bool:
        return not self.is_local

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_staging(self) -> bool:
        return self.ENVIRONMENT == "staging"

    def __repr__(self) -> str:
        return (
            f"Settings("
            f"ENVIRONMENT={self.ENVIRONMENT}, "
            f"is_local={self.is_local}, "
            f"FIREBASE_STORAGE_BUCKET={self.FIREBASE_STORAGE_BUCKET}, "
            f"GCP_PROJECT_ID={self.GCP_PROJECT_ID}, "
            f"LANGSMITH_PROJECT={self.LANGSMITH_PROJECT}"
            f")"
        )


settings = Settings()
