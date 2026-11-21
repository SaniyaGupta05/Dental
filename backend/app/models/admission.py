import enum
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Boolean, Integer, Float, Text, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class WardType(str, enum.Enum):
    GENERAL = "GENERAL"
    SEMI_PRIVATE = "SEMI_PRIVATE"
    PRIVATE = "PRIVATE"


class BedStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    CLEANING = "CLEANING"
    MAINTENANCE = "MAINTENANCE"


class AdmissionStatus(str, enum.Enum):
    ADMITTED = "ADMITTED"
    DISCHARGED = "DISCHARGED"
    TRANSFERRED = "TRANSFERRED"
    CANCELLED = "CANCELLED"


class AdmissionType(str, enum.Enum):
    OPD_CONVERTED = "OPD_CONVERTED"
    EMERGENCY = "EMERGENCY"
    DIRECT = "DIRECT"


class InpatientNoteType(str, enum.Enum):
    DOCTOR_ROUND = "DOCTOR_ROUND"
    NURSING_VITALS = "NURSING_VITALS"
    MEDICATION = "MEDICATION"
    PROCEDURE = "PROCEDURE"


class Ward(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "wards"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ward_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    floor: Mapped[str] = mapped_column(String(50), default="3rd Floor", nullable=False)
    daily_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    beds: Mapped[List["Bed"]] = relationship("Bed", back_populates="ward", cascade="all, delete-orphan")


class Bed(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "beds"

    ward_id: Mapped[str] = mapped_column(String(36), ForeignKey("wards.id", ondelete="CASCADE"), nullable=False, index=True)
    bed_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=BedStatus.AVAILABLE.value, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    ward: Mapped["Ward"] = relationship("Ward", back_populates="beds")
    admissions: Mapped[List["Admission"]] = relationship("Admission", back_populates="bed")


class Admission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "admissions"

    admission_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patient_profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id: Mapped[str] = mapped_column(String(36), ForeignKey("doctor_profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    bed_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("beds.id", ondelete="SET NULL"), nullable=True, index=True)
    opd_appointment_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)

    admission_type: Mapped[str] = mapped_column(String(30), default=AdmissionType.DIRECT.value, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=AdmissionStatus.ADMITTED.value, nullable=False, index=True)

    admitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    discharged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    chief_complaints: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admission_diagnosis: Mapped[str] = mapped_column(Text, nullable=False)
    guardian_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    guardian_relation: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    guardian_phone: Mapped[Optional[str]] = mapped_column(String(25), nullable=True)

    # Mediclaim / Cashless info
    is_cashless: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mediclaim_provider: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    mediclaim_policy_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    # Discharge summary fields
    discharge_diagnosis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    treatment_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discharge_medications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    # Relationships
    patient: Mapped["PatientProfile"] = relationship("PatientProfile", back_populates="admissions")
    doctor: Mapped["DoctorProfile"] = relationship("DoctorProfile", back_populates="admissions")
    bed: Mapped[Optional["Bed"]] = relationship("Bed", back_populates="admissions")
    opd_appointment: Mapped[Optional["Appointment"]] = relationship("Appointment")
    notes: Mapped[List["InpatientNote"]] = relationship("InpatientNote", back_populates="admission", cascade="all, delete-orphan", order_by="InpatientNote.recorded_at.desc()")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="admission")


class InpatientNote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inpatient_notes"

    admission_id: Mapped[str] = mapped_column(String(36), ForeignKey("admissions.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    note_type: Mapped[str] = mapped_column(String(30), default=InpatientNoteType.DOCTOR_ROUND.value, nullable=False)

    temperature_f: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pulse_bpm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    respiratory_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    spo2_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    admission: Mapped["Admission"] = relationship("Admission", back_populates="notes")
    recorded_by: Mapped["User"] = relationship("User")
