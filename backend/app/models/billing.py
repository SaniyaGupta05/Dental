import enum
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class BillingType(str, enum.Enum):
    OPD = "OPD"
    IPD = "IPD"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    MEDICLAIM = "MEDICLAIM"
    MIXED = "MIXED"


class InvoiceItemCategory(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    BED_CHARGE = "BED_CHARGE"
    PROCEDURE = "PROCEDURE"
    PHARMACY = "PHARMACY"
    LAB = "LAB"
    VACCINATION = "VACCINATION"
    OTHER = "OTHER"


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patient_profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    appointment_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    admission_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("admissions.id", ondelete="SET NULL"), nullable=True, index=True)

    billing_type: Mapped[str] = mapped_column(String(20), default=BillingType.OPD.value, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default=InvoiceStatus.ISSUED.value, nullable=False, index=True)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    payment_method: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    patient: Mapped["PatientProfile"] = relationship("PatientProfile", back_populates="invoices")
    appointment: Mapped[Optional["Appointment"]] = relationship("Appointment")
    admission: Mapped[Optional["Admission"]] = relationship("Admission", back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[str] = mapped_column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(30), default=InvoiceItemCategory.OTHER.value, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")
