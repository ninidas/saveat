from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)


class AppConfig(Base):
    """Stockage clé/valeur pour la configuration applicative."""
    __tablename__ = "app_config"

    key   = Column(String, primary_key=True)
    value = Column(String, nullable=False)


class Store(Base):
    """Enseigne de supermarché."""
    __tablename__ = "stores"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False, unique=True)
    color      = Column(String, nullable=False, default="#6b7280")
    sort_order = Column(Integer, default=0)

    prices = relationship("ProductPrice", back_populates="store", cascade="all, delete-orphan")


class Product(Base):
    """Produit alimentaire."""
    __tablename__ = "products"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, nullable=False)
    category = Column(String, nullable=True)
    unit     = Column(String, nullable=False, default="unité")  # kg, L, unité, etc.
    barcode  = Column(String, nullable=True)

    prices = relationship("ProductPrice", back_populates="product", cascade="all, delete-orphan")


class ProductPrice(Base):
    """Prix d'un produit dans une enseigne donnée."""
    __tablename__ = "product_prices"

    id         = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    store_id   = Column(Integer, ForeignKey("stores.id"), nullable=False)
    price      = Column(Float, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    product = relationship("Product", back_populates="prices")
    store   = relationship("Store", back_populates="prices")


class ImportSession(Base):
    """Historique des imports de tickets de caisse."""
    __tablename__ = "import_sessions"

    id           = Column(Integer, primary_key=True, index=True)
    store_id     = Column(Integer, ForeignKey("stores.id"), nullable=True)
    store_name   = Column(String, nullable=False)
    imported_at  = Column(DateTime, nullable=False, default=datetime.utcnow)
    item_count   = Column(Integer, nullable=False, default=0)
    total_amount = Column(Float, nullable=False, default=0.0)

    store = relationship("Store", foreign_keys=[store_id])


class PriceHistory(Base):
    """Historique des changements de prix."""
    __tablename__ = "price_history"

    id         = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    store_id   = Column(Integer, ForeignKey("stores.id"), nullable=False)
    price      = Column(Float, nullable=False)
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow)


