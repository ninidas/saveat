import logging
logging.basicConfig(level=logging.INFO)

from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .limiter import limiter
from .database import engine, get_db
from . import models
from .auth import get_current_user_optional
from .routers import auth, setup, users, stores, products, settings, receipt, imports

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Saveat")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import APIRouter
api_router = APIRouter(prefix="/api")
api_router.include_router(setup.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(stores.router)
api_router.include_router(products.router)
api_router.include_router(settings.router)
api_router.include_router(receipt.router)
api_router.include_router(imports.router)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def get_config(
    db=Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    setup_needed = db.query(models.User).count() == 0
    return {
        "setup_needed": setup_needed,
        "authenticated": current_user is not None,
        "username": current_user.username if current_user else None,
    }


# Frontend SPA
_FRONTEND_DIST = Path(__file__).parent.parent / "frontend_dist"

if (_FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="static_assets")


@app.get("/{full_path:path}")
async def spa_handler(full_path: str):
    if _FRONTEND_DIST.exists():
        candidate = _FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            headers = {}
            if full_path in ("sw.js",) or full_path.endswith(".webmanifest"):
                headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return FileResponse(str(candidate), headers=headers)
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
    return {"detail": "Frontend non disponible"}
