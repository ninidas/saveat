from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=schemas.SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    key_cfg = db.query(models.AppConfig).filter_by(key="claude_api_key").first()
    return schemas.SettingsResponse(claude_api_key_set=bool(key_cfg and key_cfg.value))


@router.patch("", response_model=schemas.SettingsResponse)
def update_settings(
    body: schemas.SettingsUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    if body.claude_api_key is not None:
        cfg = db.query(models.AppConfig).filter_by(key="claude_api_key").first()
        if body.claude_api_key == "":
            # Supprimer la clé
            if cfg:
                db.delete(cfg)
        else:
            if cfg:
                cfg.value = body.claude_api_key
            else:
                db.add(models.AppConfig(key="claude_api_key", value=body.claude_api_key))
        db.commit()

    key_cfg = db.query(models.AppConfig).filter_by(key="claude_api_key").first()
    return schemas.SettingsResponse(claude_api_key_set=bool(key_cfg and key_cfg.value))
