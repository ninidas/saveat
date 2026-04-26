from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# Auth

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    user_id: int
    username: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class SetupStatus(BaseModel):
    needed: bool


class SetupRequest(BaseModel):
    username: str
    password: str


# Stores

class StoreCreate(BaseModel):
    name: str
    color: str = "#6b7280"
    sort_order: int = 0


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


class StoreResponse(BaseModel):
    id: int
    name: str
    color: str
    sort_order: int

    class Config:
        from_attributes = True


# Products

class ProductPriceCreate(BaseModel):
    store_id: int
    price: float


class ProductPriceUpdate(BaseModel):
    price: float


class PriceHistoryEntry(BaseModel):
    price: float
    recorded_at: datetime

    class Config:
        from_attributes = True


class ProductPriceResponse(BaseModel):
    id: int
    store_id: int
    store_name: str
    store_color: str
    price: float
    updated_at: datetime
    history: list[PriceHistoryEntry] = []

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    unit: str = "unité"
    barcode: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    barcode: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    category: Optional[str]
    unit: str
    barcode: Optional[str]
    prices: list[ProductPriceResponse] = []
    best_price: Optional[float] = None
    best_store: Optional[str] = None

    class Config:
        from_attributes = True


# Comparison

class StoreTotal(BaseModel):
    store_id: int
    store_name: str
    store_color: str
    total: float
    missing_count: int  # nb de produits sans prix dans ce magasin
    is_cheapest: bool = False


class ComparisonResult(BaseModel):
    store_totals: list[StoreTotal]
    cheapest_store_id: Optional[int] = None


# Import sessions

class ImportSessionCreate(BaseModel):
    store_id:     int
    store_name:   str
    item_count:   int
    total_amount: float


class ImportSessionResponse(BaseModel):
    id:           int
    store_id:     Optional[int]
    store_name:   str
    store_color:  Optional[str] = None
    imported_at:  datetime
    item_count:   int
    total_amount: float

    class Config:
        from_attributes = True


# Merge

class MergeRequest(BaseModel):
    source_id: int


# Settings

class SettingsUpdate(BaseModel):
    claude_api_key: Optional[str] = None


class SettingsResponse(BaseModel):
    claude_api_key_set: bool
