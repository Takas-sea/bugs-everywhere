import asyncio
import traceback

from fastapi import FastAPI

from app.api.diary import router
from app.services.diary_generator import process_pending_panels


async def _panel_worker_loop() -> None:
    print("[ワーカー] 起動しました。10秒おきに生成待ちのコマを探します。")
    tick = 0
    while True:
        try:
            processed = process_pending_panels()
            if processed:
                print(f"[ワーカー] {len(processed)}件を処理しました")
            else:
                tick += 1
                # 生きていることが分かるように、たまに出す
                if tick % 6 == 1:
                    print("[ワーカー] 生成待ちのコマはありません")
        except Exception:
            # 黙って握りつぶすと、動かない理由が分からなくなる
            traceback.print_exc()
        await asyncio.sleep(10)


app = FastAPI(title="Bugs Everywhere API")
app.include_router(router)


@app.on_event("startup")
async def startup_event() -> None:
    asyncio.create_task(_panel_worker_loop())
