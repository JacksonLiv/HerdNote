import uuid
from datetime import datetime

from pydantic import BaseModel


class EvidenceOut(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    parent_type: str
    parent_id: uuid.UUID
    filename: str
    content_type: str
    sha256: str
    caption: str | None
    uploaded_by: uuid.UUID
    uploaded_at: datetime
    url: str
