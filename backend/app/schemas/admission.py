from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class BedResponse(BaseModel):
    id: str
    ward_id: str
    bed_number: str
    status: str
    notes: Optional[str] = None
    is_active: bool
    current_admission_id: Optional[str] = None
    current_patient_name: Optional[str] = None


class WardResponse(BaseModel):
    id: str
    name: str
    ward_type: str
    floor: str
    daily_rate: float
    description: Optional[str] = None
    is_active: bool
    total_beds: int = 0
    available_beds: int = 0
    occupied_beds: int = 0
    beds: List[BedResponse] = []


class WardCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    ward_type: str = Field(..., pattern="^(GENERAL|SEMI_PRIVATE|PRIVATE)$")
    floor: str = "3rd Floor"
    daily_rate: float = Field(..., ge=0)
    description: Optional[str] = None


class BedCreateRequest(BaseModel):
    ward_id: str
    bed_number: str = Field(..., min_length=2, max_length=30)
    notes: Optional[str] = None


class BedUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(AVAILABLE|OCCUPIED|CLEANING|MAINTENANCE)$")
    notes: Optional[str] = None


class InpatientNoteCreateRequest(BaseModel):
    note_type: str = Field(default="DOCTOR_ROUND", pattern="^(DOCTOR_ROUND|NURSING_VITALS|MEDICATION|PROCEDURE)$")
    temperature_f: Optional[float] = None
    pulse_bpm: Optional[int] = None
    respiratory_rate: Optional[int] = None
    spo2_percent: Optional[int] = None
    weight_kg: Optional[float] = None
    notes: str = Field(..., min_length=1)


class InpatientNoteResponse(BaseModel):
    id: str
    admission_id: str
    recorded_by_id: str
    recorded_by_name: Optional[str] = None
    note_type: str
    temperature_f: Optional[float] = None
    pulse_bpm: Optional[int] = None
    respiratory_rate: Optional[int] = None
    spo2_percent: Optional[int] = None
    weight_kg: Optional[float] = None
    notes: str
    recorded_at: datetime


class AdmissionCreateRequest(BaseModel):
    patient_id: str
    doctor_id: str
    bed_id: str
    opd_appointment_id: Optional[str] = None
    admission_type: str = Field(default="DIRECT", pattern="^(OPD_CONVERTED|EMERGENCY|DIRECT)$")
    chief_complaints: Optional[str] = None
    admission_diagnosis: str = Field(..., min_length=2)
    guardian_name: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_phone: Optional[str] = None
    is_cashless: bool = False
    mediclaim_provider: Optional[str] = None
    mediclaim_policy_number: Optional[str] = None


class AdmissionTransferRequest(BaseModel):
    new_bed_id: str
    reason: Optional[str] = None


class AdmissionDischargeRequest(BaseModel):
    discharge_diagnosis: str = Field(..., min_length=2)
    treatment_summary: str = Field(..., min_length=2)
    discharge_medications: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[date] = None


class AdmissionSummaryResponse(BaseModel):
    id: str
    admission_number: str
    patient_id: str
    patient_name: str
    patient_phone: Optional[str] = None
    patient_dob: Optional[date] = None
    patient_gender: Optional[str] = None
    doctor_id: str
    doctor_name: str
    bed_id: Optional[str] = None
    bed_number: Optional[str] = None
    ward_name: Optional[str] = None
    ward_type: Optional[str] = None
    daily_rate: float = 0.0
    opd_appointment_id: Optional[str] = None
    admission_type: str
    status: str
    admitted_at: datetime
    discharged_at: Optional[datetime] = None
    admission_diagnosis: str
    chief_complaints: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_phone: Optional[str] = None
    is_cashless: bool
    mediclaim_provider: Optional[str] = None
    mediclaim_policy_number: Optional[str] = None
    discharge_diagnosis: Optional[str] = None
    treatment_summary: Optional[str] = None
    discharge_medications: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[date] = None


class AdmissionDetailResponse(AdmissionSummaryResponse):
    notes: List[InpatientNoteResponse] = []
