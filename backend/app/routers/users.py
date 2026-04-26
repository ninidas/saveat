import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import hash_password, get_current_user, verify_password, create_access_token

router = APIRouter(prefix="/users", tags=["users"])


class DeleteAccountRequest(BaseModel):
    password: str


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur requis")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (8 caractères min.)")
    if db.query(models.User).filter_by(username=body.username.strip()).first():
        raise HTTPException(status_code=409, detail="Nom d'utilisateur déjà pris")

    max_users = int(os.getenv("MAX_USERS", "5"))
    if db.query(models.User).count() >= max_users:
        raise HTTPException(status_code=403, detail="Nombre maximum d'utilisateurs atteint")

    user = models.User(username=body.username.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.username)
    return schemas.TokenResponse(access_token=token, user_id=user.id, username=user.username)


@router.delete("/me", status_code=204)
def delete_account(
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect")
    db.delete(current_user)
    db.commit()
