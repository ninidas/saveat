from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("", response_model=schemas.ImportSessionResponse, status_code=201)
def create_import_session(
    body: schemas.ImportSessionCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    session = models.ImportSession(
        store_id=body.store_id,
        store_name=body.store_name,
        item_count=body.item_count,
        total_amount=body.total_amount,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    color = session.store.color if session.store else None
    return schemas.ImportSessionResponse(
        id=session.id,
        store_id=session.store_id,
        store_name=session.store_name,
        store_color=color,
        imported_at=session.imported_at,
        item_count=session.item_count,
        total_amount=session.total_amount,
    )


@router.get("", response_model=list[schemas.ImportSessionResponse])
def list_import_sessions(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    sessions = (
        db.query(models.ImportSession)
        .order_by(models.ImportSession.imported_at.desc())
        .limit(50)
        .all()
    )
    return [
        schemas.ImportSessionResponse(
            id=s.id,
            store_id=s.store_id,
            store_name=s.store_name,
            store_color=s.store.color if s.store else None,
            imported_at=s.imported_at,
            item_count=s.item_count,
            total_amount=s.total_amount,
        )
        for s in sessions
    ]
