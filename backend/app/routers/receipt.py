import base64
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_user

router = APIRouter(prefix="/receipt", tags=["receipt"])


class ReceiptItem(BaseModel):
    name: str
    price: float
    unit: str = "unité"


class ReceiptAnalysisResponse(BaseModel):
    items: list[ReceiptItem]
    store_name: str | None = None


@router.post("/analyze", response_model=ReceiptAnalysisResponse)
async def analyze_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    key_cfg = db.query(models.AppConfig).filter_by(key="claude_api_key").first()
    if not key_cfg or not key_cfg.value:
        raise HTTPException(
            status_code=400,
            detail="Clé API Claude non configurée. Veuillez la renseigner dans les paramètres."
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB max
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 10 Mo)")

    media_type = file.content_type or "image/jpeg"
    if media_type not in ("image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"):
        raise HTTPException(status_code=400, detail="Format non supporté (images ou PDF uniquement)")

    image_data = base64.standard_b64encode(content).decode("utf-8")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key_cfg.value)

        is_pdf     = media_type == "application/pdf"
        doc_block  = {
            "type": "document" if is_pdf else "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_data,
            },
        }

        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        doc_block,
                        {
                            "type": "text",
                            "text": (
                                "Analyse ce ticket de caisse et extrais la liste des produits alimentaires "
                                "avec leur prix unitaire. Réponds UNIQUEMENT avec un JSON valide ayant ce format :\n"
                                '{"store_name": "Nom du magasin ou null", "items": [{"name": "Nom du produit", "price": 1.99, "unit": "unité"}]}\n'
                                "- 'price' est le montant total payé pour cet article (la somme débitée), jamais le prix au kg ou au litre\n"
                                "- Par exemple pour '1 x 8.83  0.476kg x 18.55€/kg', le price est 8.83 (pas 18.55)\n"
                                "- 'unit' est parmi : kg, L, unité, 100g, cl\n"
                                "- Inclure tous les produits (alimentaires, hygiène, entretien, etc.)\n"
                                "- Si un prix n'est pas lisible, ne pas inclure le produit\n"
                                "Réponds uniquement avec le JSON, sans texte autour."
                            ),
                        },
                    ],
                }
            ],
        )

        raw = message.content[0].text.strip()
        logging.getLogger(__name__).info("Claude raw response: %s", raw)

        # Extraire le bloc JSON quelle que soit la mise en forme
        import re
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            raise ValueError(f"Aucun JSON trouvé dans la réponse : {raw[:200]}")
        data = json.loads(json_match.group())
        items = [ReceiptItem(**item) for item in data.get("items", [])]
        return ReceiptAnalysisResponse(items=items, store_name=data.get("store_name"))

    except (json.JSONDecodeError, ValueError) as e:
        logging.getLogger(__name__).error("JSON parse error: %s", e)
        raise HTTPException(status_code=500, detail=f"Impossible d'interpréter la réponse de Claude : {str(e)}")
    except Exception as e:
        logging.getLogger(__name__).error("Receipt analysis error: %s", e)
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse : {str(e)}")
