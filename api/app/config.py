import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "local")
    ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        "./dev-firebase-adminsdk-service-account.json",
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "prod"

    @property
    def is_cloud(self) -> bool:
        return self.ENVIRONMENT in ["dev", "prod"]


settings = Settings()
