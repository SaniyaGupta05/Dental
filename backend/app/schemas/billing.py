from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class InvoiceItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    category: str = Field(
        default="OTHER",
        pattern="^(CONSULTATION|BED_CHARGE|PROCEDURE|PHARMACY|LAB|VACCINATION|OTHER)$",
    )
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0)


class InvoiceItemResponse(BaseModel):
    id: str
    description: str
    category: str
    quantity: int
    unit_price: float
    total_price: float


class InvoiceCreateRequest(BaseModel):
    patient_id: str
    appointment_id: Optional[str] = None
    admission_id: Optional[str] = None
    billing_type: str = Field(default="OPD", pattern="^(OPD|IPD)$")
    discount_amount: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    paid_amount: float = Field(default=0.0, ge=0)
    payment_method: Optional[str] = Field(default=None, pattern="^(CASH|UPI|CARD|MEDICLAIM|MIXED)$")
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = Field(..., min_length=1)


class InvoicePaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., pattern="^(CASH|UPI|CARD|MEDICLAIM|MIXED)$")
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    patient_id: str
    patient_name: str
    patient_phone: Optional[str] = None
    appointment_id: Optional[str] = None
    admission_id: Optional[str] = None
    admission_number: Optional[str] = None
    billing_type: str
    status: str
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    paid_amount: float
    balance_amount: float
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    issued_at: datetime
    items: List[InvoiceItemResponse] = []
