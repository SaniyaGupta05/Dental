from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_staff
from app.models.user import User, UserRole
from app.models.profile import PatientProfile
from app.models.admission import Admission
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus
from app.schemas.billing import (
    InvoiceCreateRequest,
    InvoicePaymentRequest,
    InvoiceResponse,
    InvoiceItemResponse,
)

router = APIRouter()


def _serialize_invoice(inv: Invoice) -> InvoiceResponse:
    balance = max(0.0, round(inv.total_amount - inv.paid_amount, 2))
    return InvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        patient_id=inv.patient_id,
        patient_name=inv.patient.full_name if inv.patient else "Unknown",
        patient_phone=inv.patient.user.phone if inv.patient and inv.patient.user else None,
        appointment_id=inv.appointment_id,
        admission_id=inv.admission_id,
        admission_number=inv.admission.admission_number if inv.admission else None,
        billing_type=inv.billing_type,
        status=inv.status,
        subtotal=inv.subtotal,
        discount_amount=inv.discount_amount,
        tax_amount=inv.tax_amount,
        total_amount=inv.total_amount,
        paid_amount=inv.paid_amount,
        balance_amount=balance,
        payment_method=inv.payment_method,
        notes=inv.notes,
        issued_at=inv.issued_at,
        items=[
            InvoiceItemResponse(
                id=item.id,
                description=item.description,
                category=item.category,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item.total_price,
            )
            for item in inv.items
        ],
    )


def _generate_invoice_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Invoice).count() + 1
    candidate = f"INV-{year}-{count:04d}"
    while db.query(Invoice).filter(Invoice.invoice_number == candidate).first():
        count += 1
        candidate = f"INV-{year}-{count:04d}"
    return candidate


@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    billing_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[str] = Query(None),
    admission_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    query = db.query(Invoice).options(
        joinedload(Invoice.patient).joinedload(PatientProfile.user),
        joinedload(Invoice.admission),
        joinedload(Invoice.items),
    )
    if billing_type:
        query = query.filter(Invoice.billing_type == billing_type)
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    if patient_id:
        query = query.filter(Invoice.patient_id == patient_id)
    if admission_id:
        query = query.filter(Invoice.admission_id == admission_id)
    if appointment_id:
        query = query.filter(Invoice.appointment_id == appointment_id)

    invoices = query.order_by(Invoice.issued_at.desc()).all()
    return [_serialize_invoice(inv) for inv in invoices]


@router.get("/invoices/me", response_model=List[InvoiceResponse])
def get_my_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient:
        return []
    invoices = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.patient).joinedload(PatientProfile.user),
            joinedload(Invoice.admission),
            joinedload(Invoice.items),
        )
        .filter(Invoice.patient_id == patient.id)
        .order_by(Invoice.issued_at.desc())
        .all()
    )
    return [_serialize_invoice(inv) for inv in invoices]


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    req: InvoiceCreateRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    patient = db.query(PatientProfile).filter(PatientProfile.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if req.admission_id:
        adm = db.query(Admission).filter(Admission.id == req.admission_id).first()
        if not adm:
            raise HTTPException(status_code=404, detail="Admission not found")

    subtotal = 0.0
    items_to_add: List[InvoiceItem] = []
    for item_req in req.items:
        line_total = round(item_req.quantity * item_req.unit_price, 2)
        subtotal += line_total
        items_to_add.append(
            InvoiceItem(
                description=item_req.description,
                category=item_req.category,
                quantity=item_req.quantity,
                unit_price=item_req.unit_price,
                total_price=line_total,
            )
        )

    subtotal = round(subtotal, 2)
    total_amount = max(0.0, round(subtotal - req.discount_amount + req.tax_amount, 2))
    paid_amount = min(total_amount, round(req.paid_amount, 2))

    if paid_amount >= total_amount and total_amount > 0:
        inv_status = InvoiceStatus.PAID.value
    elif paid_amount > 0:
        inv_status = InvoiceStatus.PARTIALLY_PAID.value
    else:
        inv_status = InvoiceStatus.ISSUED.value

    invoice = Invoice(
        invoice_number=_generate_invoice_number(db),
        patient_id=req.patient_id,
        appointment_id=req.appointment_id,
        admission_id=req.admission_id,
        billing_type=req.billing_type,
        status=inv_status,
        subtotal=subtotal,
        discount_amount=req.discount_amount,
        tax_amount=req.tax_amount,
        total_amount=total_amount,
        paid_amount=paid_amount,
        payment_method=req.payment_method,
        notes=req.notes,
        issued_at=datetime.now(timezone.utc),
        created_by_id=current_user.id,
        items=items_to_add,
    )
    db.add(invoice)
    db.commit()

    loaded = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.patient).joinedload(PatientProfile.user),
            joinedload(Invoice.admission),
            joinedload(Invoice.items),
        )
        .filter(Invoice.id == invoice.id)
        .first()
    )
    return _serialize_invoice(loaded)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice_detail(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.patient).joinedload(PatientProfile.user),
            joinedload(Invoice.admission),
            joinedload(Invoice.items),
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if current_user.role == UserRole.PATIENT.value:
        patient = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if not patient or inv.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Access denied")
    return _serialize_invoice(inv)


@router.post("/invoices/{invoice_id}/pay", response_model=InvoiceResponse)
def record_invoice_payment(
    invoice_id: str,
    req: InvoicePaymentRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.patient).joinedload(PatientProfile.user),
            joinedload(Invoice.admission),
            joinedload(Invoice.items),
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == InvoiceStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Cannot pay a cancelled invoice")

    inv.paid_amount = min(inv.total_amount, round(inv.paid_amount + req.amount, 2))
    inv.payment_method = req.payment_method
    if req.notes:
        inv.notes = f"{inv.notes}\n{req.notes}".strip() if inv.notes else req.notes

    if inv.paid_amount >= inv.total_amount:
        inv.status = InvoiceStatus.PAID.value
    elif inv.paid_amount > 0:
        inv.status = InvoiceStatus.PARTIALLY_PAID.value

    db.commit()
    db.refresh(inv)
    return _serialize_invoice(inv)
