from fastapi import APIRouter
from app.api.v1 import search

api_router = APIRouter()

# Đăng ký tất cả routers
api_router.include_router(search.router)
