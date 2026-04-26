from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    total_products = db.query(models.Product).count()
    total_stores   = db.query(models.Store).count()
    products_without_prices = (
        db.query(models.Product)
        .filter(~models.Product.prices.any())
        .count()
    )
    recent = (
        db.query(models.PriceHistory, models.Product, models.Store)
        .join(models.Product, models.PriceHistory.product_id == models.Product.id)
        .join(models.Store,   models.PriceHistory.store_id   == models.Store.id)
        .order_by(models.PriceHistory.recorded_at.desc())
        .limit(10)
        .all()
    )
    return {
        "total_products": total_products,
        "total_stores": total_stores,
        "products_without_prices": products_without_prices,
        "recent_prices": [
            {
                "product_name": product.name,
                "store_name":   store.name,
                "store_color":  store.color,
                "price":        hist.price,
                "recorded_at":  hist.recorded_at.isoformat(),
            }
            for hist, product, store in recent
        ],
    }


@router.get("/categories/list")
def list_categories(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    rows = db.query(models.Product.category).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


def _build_product_response(product: models.Product, db: Session) -> schemas.ProductResponse:
    prices = []
    best_price = None
    best_store = None

    for pp in product.prices:
        hist = (
            db.query(models.PriceHistory)
            .filter_by(product_id=product.id, store_id=pp.store_id)
            .order_by(models.PriceHistory.recorded_at.desc())
            .limit(10)
            .all()
        )
        prices.append(schemas.ProductPriceResponse(
            id=pp.id,
            store_id=pp.store_id,
            store_name=pp.store.name,
            store_color=pp.store.color,
            price=pp.price,
            updated_at=pp.updated_at,
            history=[schemas.PriceHistoryEntry(price=h.price, recorded_at=h.recorded_at) for h in hist],
        ))
        if best_price is None or pp.price < best_price:
            best_price = pp.price
            best_store = pp.store.name

    return schemas.ProductResponse(
        id=product.id,
        name=product.name,
        category=product.category,
        unit=product.unit,
        barcode=product.barcode,
        prices=prices,
        best_price=best_price,
        best_store=best_store,
    )


@router.get("", response_model=list[schemas.ProductResponse])
def list_products(
    search: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = db.query(models.Product)
    if search:
        q = q.filter(models.Product.name.ilike(f"%{search}%"))
    if category:
        q = q.filter(models.Product.category == category)
    products = q.order_by(models.Product.name).all()
    return [_build_product_response(p, db) for p in products]


@router.post("", response_model=schemas.ProductResponse, status_code=201)
def create_product(
    body: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    product = models.Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return _build_product_response(product, db)


@router.get("/{product_id}", response_model=schemas.ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return _build_product_response(product, db)


@router.patch("/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    body: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return _build_product_response(product, db)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    db.delete(product)
    db.commit()


# ── Prices ────────────────────────────────────────────────────────────────────

@router.put("/{product_id}/prices/{store_id}", response_model=schemas.ProductPriceResponse)
def upsert_price(
    product_id: int,
    store_id: int,
    body: schemas.ProductPriceUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    product = db.query(models.Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    store = db.query(models.Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Enseigne introuvable")

    pp = db.query(models.ProductPrice).filter_by(product_id=product_id, store_id=store_id).first()
    now = datetime.utcnow()
    if pp:
        if pp.price != body.price:
            db.add(models.PriceHistory(product_id=product_id, store_id=store_id, price=body.price, recorded_at=now))
        pp.price      = body.price
        pp.updated_at = now
    else:
        pp = models.ProductPrice(product_id=product_id, store_id=store_id, price=body.price, updated_at=now)
        db.add(pp)
        db.add(models.PriceHistory(product_id=product_id, store_id=store_id, price=body.price, recorded_at=now))
    db.commit()
    db.refresh(pp)

    hist = (
        db.query(models.PriceHistory)
        .filter_by(product_id=product_id, store_id=store_id)
        .order_by(models.PriceHistory.recorded_at.desc())
        .limit(10)
        .all()
    )
    return schemas.ProductPriceResponse(
        id=pp.id,
        store_id=pp.store_id,
        store_name=store.name,
        store_color=store.color,
        price=pp.price,
        updated_at=pp.updated_at,
        history=[schemas.PriceHistoryEntry(price=h.price, recorded_at=h.recorded_at) for h in hist],
    )


@router.delete("/{product_id}/prices/{store_id}", status_code=204)
def delete_price(
    product_id: int,
    store_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    pp = db.query(models.ProductPrice).filter_by(product_id=product_id, store_id=store_id).first()
    if not pp:
        raise HTTPException(status_code=404, detail="Prix introuvable")
    db.delete(pp)
    db.commit()
