from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import hash_password

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=schemas.SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    needed = db.query(models.User).count() == 0
    return schemas.SetupStatus(needed=needed)


@router.post("", status_code=201)
def do_setup(body: schemas.SetupRequest, db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="Setup déjà effectué")
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur requis")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (8 caractères min.)")

    db.add(models.User(
        username=body.username.strip(),
        password_hash=hash_password(body.password),
    ))

    # Enseignes par défaut
    default_stores = [
        {"name": "Carrefour",     "color": "#003ca6"},
        {"name": "Leclerc",       "color": "#003189"},
        {"name": "Lidl",          "color": "#0050aa"},
        {"name": "Auchan",        "color": "#e63025"},
        {"name": "Intermarché",   "color": "#e30613"},
    ]
    for i, s in enumerate(default_stores):
        db.add(models.Store(name=s["name"], color=s["color"], sort_order=i))

    db.commit()
    return {"detail": "Setup terminé"}
