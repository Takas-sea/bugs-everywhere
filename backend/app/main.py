import asyncio

from fastapi import FastAPI

from app.api.diary import router
from app.services.diary_generator import process_pending_panels


async def _panel_worker_loop() -> None:
    while True:
        try:
            process_pending_panels()
        except Exception:
            pass
        await asyncio.sleep(10)


app = FastAPI(title="Bugs Everywhere API")
app.include_router(router)


@app.on_event("startup")
async def startup_event() -> None:
    asyncio.create_task(_panel_worker_loop())
