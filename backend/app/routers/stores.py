from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=list[schemas.StoreResponse])
def list_stores(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.query(models.Store).order_by(models.Store.sort_order, models.Store.name).all()


@router.post("", response_model=schemas.StoreResponse, status_code=201)
def create_store(
    body: schemas.StoreCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    if db.query(models.Store).filter_by(name=body.name).first():
        raise HTTPException(status_code=409, detail="Cette enseigne existe déjà")
    store = models.Store(**body.model_dump())
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.patch("/{store_id}", response_model=schemas.StoreResponse)
def update_store(
    store_id: int,
    body: schemas.StoreUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    store = db.query(models.Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Enseigne introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(store, field, value)
    db.commit()
    db.refresh(store)
    return store


@router.delete("/{store_id}", status_code=204)
def delete_store(
    store_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    store = db.query(models.Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Enseigne introuvable")
    db.delete(store)
    db.commit()
