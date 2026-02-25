from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import users
from app.services.firebase import get_db, init_firebase


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    yield


app = FastAPI(title="API Server", lifespan=lifespan)

app.include_router(users.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    try:
        db = get_db()
        db.collection("_health_check").limit(1).get()
        return {
            "status": "ok",
            "environment": settings.ENVIRONMENT,
            "firebase": "connected",
        }
    except Exception:
        return {
            "status": "error",
            "environment": settings.ENVIRONMENT,
            "firebase": "failed",
        }
