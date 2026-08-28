from fastapi import FastAPI

from app.api.diary import router

app = FastAPI(title="Bugs Everywhere API")
app.include_router(router)
