import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.diary import router
from app.services.diary_generator import process_pending_panels


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Bugs Everywhere API")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# API
# ============================================================

app.include_router(router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Bugs Everywhere API is running",
    }


# ============================================================
# AI panel worker
# ============================================================

async def _panel_worker_loop() -> None:

    logger.info("AI panel worker started")

    while True:

        try:

            logger.info(
                "pending panel を確認しています..."
            )

            # 同期関数なので別スレッドで実行
            await asyncio.to_thread(
                process_pending_panels
            )

        except Exception as exc:

            # 以前は pass だったため、
            # Gemini等でエラーが起きても分からなかった
            logger.exception(
                "panel生成処理でエラーが発生しました: %s",
                exc,
            )

        await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event() -> None:

    asyncio.create_task(
        _panel_worker_loop()
    )