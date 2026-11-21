from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_staff, require_admin
from app.models.user import User, UserRole
from app.models.profile import PatientProfile, DoctorProfile
from app.models.appointment import Appointment, AppointmentStatus
from app.models.notification import FollowUp, FollowUpStatus
from app.models.admission import (
    Ward,
    Bed,
    Admission,
    InpatientNote,
    BedStatus,
    AdmissionStatus,
    AdmissionType,
)
from app.schemas.admission import (
    WardResponse,
    BedResponse,
    WardCreateRequest,
    BedCreateRequest,
    BedUpdateRequest,
    AdmissionCreateRequest,
    AdmissionTransferRequest,
    AdmissionDischargeRequest,
    AdmissionSummaryResponse,
    AdmissionDetailResponse,
    InpatientNoteCreateRequest,
    InpatientNoteResponse,
)

router = APIRouter()


def _serialize_admission(adm: Admission) -> AdmissionSummaryResponse:
    return AdmissionSummaryResponse(
        id=adm.id,
        admission_number=adm.admission_number,
        patient_id=adm.patient_id,
        patient_name=adm.patient.full_name if adm.patient else "Unknown",
        patient_phone=adm.patient.user.phone if adm.patient and adm.patient.user else None,
        patient_dob=adm.patient.date_of_birth if adm.patient else None,
        patient_gender=adm.patient.gender if adm.patient else None,
        doctor_id=adm.doctor_id,
        doctor_name=adm.doctor.full_name if adm.doctor else "Unknown",
        bed_id=adm.bed_id,
        bed_number=adm.bed.bed_number if adm.bed else None,
        ward_name=adm.bed.ward.name if adm.bed and adm.bed.ward else None,
        ward_type=adm.bed.ward.ward_type if adm.bed and adm.bed.ward else None,
        daily_rate=adm.bed.ward.daily_rate if adm.bed and adm.bed.ward else 0.0,
        opd_appointment_id=adm.opd_appointment_id,
        admission_type=adm.admission_type,
        status=adm.status,
        admitted_at=adm.admitted_at,
        discharged_at=adm.discharged_at,
        admission_diagnosis=adm.admission_diagnosis,
        chief_complaints=adm.chief_complaints,
        guardian_name=adm.guardian_name,
        guardian_relation=adm.guardian_relation,
        guardian_phone=adm.guardian_phone,
        is_cashless=adm.is_cashless,
        mediclaim_provider=adm.mediclaim_provider,
        mediclaim_policy_number=adm.mediclaim_policy_number,
        discharge_diagnosis=adm.discharge_diagnosis,
        treatment_summary=adm.treatment_summary,
        discharge_medications=adm.discharge_medications,
        follow_up_instructions=adm.follow_up_instructions,
        follow_up_date=adm.follow_up_date,
    )


def _generate_admission_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Admission).count() + 1
    candidate = f"IPD-{year}-{count:04d}"
    while db.query(Admission).filter(Admission.admission_number == candidate).first():
        count += 1
        candidate = f"IPD-{year}-{count:04d}"
    return candidate


# -------------------- Wards & Beds --------------------

@router.get("/wards", response_model=List[WardResponse])
def list_wards_with_beds(
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    wards = db.query(Ward).options(joinedload(Ward.beds)).order_by(Ward.daily_rate.asc()).all()
    active_admissions = (
        db.query(Admission)
        .options(joinedload(Admission.patient))
        .filter(Admission.status == AdmissionStatus.ADMITTED.value)
        .all()
    )
    bed_to_adm = {a.bed_id: a for a in active_admissions if a.bed_id}

    result: List[WardResponse] = []
    for ward in wards:
        bed_responses: List[BedResponse] = []
        avail_count = 0
        occ_count = 0
        for bed in sorted(ward.beds, key=lambda b: b.bed_number):
            adm = bed_to_adm.get(bed.id)
            if bed.status == BedStatus.AVAILABLE.value:
                avail_count += 1
            elif bed.status == BedStatus.OCCUPIED.value:
                occ_count += 1
            bed_responses.append(
                BedResponse(
                    id=bed.id,
                    ward_id=bed.ward_id,
                    bed_number=bed.bed_number,
                    status=bed.status,
                    notes=bed.notes,
                    is_active=bed.is_active,
                    current_admission_id=adm.id if adm else None,
                    current_patient_name=adm.patient.full_name if adm and adm.patient else None,
                )
            )
        result.append(
            WardResponse(
                id=ward.id,
                name=ward.name,
                ward_type=ward.ward_type,
                floor=ward.floor,
                daily_rate=ward.daily_rate,
                description=ward.description,
                is_active=ward.is_active,
                total_beds=len(bed_responses),
                available_beds=avail_count,
                occupied_beds=occ_count,
                beds=bed_responses,
            )
        )
    return result


@router.post("/wards", response_model=WardResponse, status_code=status.HTTP_201_CREATED)
def create_ward(
    req: WardCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(Ward).filter(Ward.name == req.name).first():
        raise HTTPException(status_code=400, detail="Ward with this name already exists")
    ward = Ward(**req.model_dump())
    db.add(ward)
    db.commit()
    db.refresh(ward)
    return WardResponse(
        id=ward.id,
        name=ward.name,
        ward_type=ward.ward_type,
        floor=ward.floor,
        daily_rate=ward.daily_rate,
        description=ward.description,
        is_active=ward.is_active,
        total_beds=0,
        available_beds=0,
        occupied_beds=0,
        beds=[],
    )


@router.post("/beds", response_model=BedResponse, status_code=status.HTTP_201_CREATED)
def create_bed(
    req: BedCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ward = db.query(Ward).filter(Ward.id == req.ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    if db.query(Bed).filter(Bed.bed_number == req.bed_number).first():
        raise HTTPException(status_code=400, detail="Bed number already exists")
    bed = Bed(ward_id=req.ward_id, bed_number=req.bed_number, notes=req.notes)
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return BedResponse(
        id=bed.id,
        ward_id=bed.ward_id,
        bed_number=bed.bed_number,
        status=bed.status,
        notes=bed.notes,
        is_active=bed.is_active,
    )


@router.patch("/beds/{bed_id}", response_model=BedResponse)
def update_bed_status(
    bed_id: str,
    req: BedUpdateRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    bed.status = req.status
    if req.notes is not None:
        bed.notes = req.notes
    db.commit()
    db.refresh(bed)
    return BedResponse(
        id=bed.id,
        ward_id=bed.ward_id,
        bed_number=bed.bed_number,
        status=bed.status,
        notes=bed.notes,
        is_active=bed.is_active,
    )


# -------------------- Admissions --------------------

@router.get("", response_model=List[AdmissionSummaryResponse])
def list_admissions(
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[str] = Query(None),
    doctor_id: Optional[str] = Query(None),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Admission)
        .options(
            joinedload(Admission.patient).joinedload(PatientProfile.user),
            joinedload(Admission.doctor),
            joinedload(Admission.bed).joinedload(Bed.ward),
        )
    )
    if status_filter:
        query = query.filter(Admission.status == status_filter)
    if patient_id:
        query = query.filter(Admission.patient_id == patient_id)
    if doctor_id:
        query = query.filter(Admission.doctor_id == doctor_id)

    admissions = query.order_by(Admission.admitted_at.desc()).all()
    return [_serialize_admission(a) for a in admissions]


@router.get("/me", response_model=List[AdmissionSummaryResponse])
def get_my_admissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient:
        return []
    admissions = (
        db.query(Admission)
        .options(
            joinedload(Admission.patient).joinedload(PatientProfile.user),
            joinedload(Admission.doctor),
            joinedload(Admission.bed).joinedload(Bed.ward),
        )
        .filter(Admission.patient_id == patient.id)
        .order_by(Admission.admitted_at.desc())
        .all()
    )
    return [_serialize_admission(a) for a in admissions]


@router.post("", response_model=AdmissionSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_admission(
    req: AdmissionCreateRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    patient = db.query(PatientProfile).filter(PatientProfile.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == req.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    bed = db.query(Bed).filter(Bed.id == req.bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    if bed.status != BedStatus.AVAILABLE.value:
        raise HTTPException(status_code=409, detail=f"Bed {bed.bed_number} is currently {bed.status}")

    active_patient_adm = (
        db.query(Admission)
        .filter(Admission.patient_id == req.patient_id, Admission.status == AdmissionStatus.ADMITTED.value)
        .first()
    )
    if active_patient_adm:
        raise HTTPException(status_code=409, detail="Patient already has an active admission")

    if req.opd_appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == req.opd_appointment_id).first()
        if not appt:
            raise HTTPException(status_code=404, detail="OPD appointment not found")
        appt.status = AppointmentStatus.COMPLETED.value

    admission = Admission(
        admission_number=_generate_admission_number(db),
        patient_id=req.patient_id,
        doctor_id=req.doctor_id,
        bed_id=req.bed_id,
        opd_appointment_id=req.opd_appointment_id,
        admission_type=req.admission_type,
        status=AdmissionStatus.ADMITTED.value,
        admitted_at=datetime.now(timezone.utc),
        chief_complaints=req.chief_complaints,
        admission_diagnosis=req.admission_diagnosis,
        guardian_name=req.guardian_name or patient.guardian_name or patient.emergency_contact_name,
        guardian_relation=req.guardian_relation or patient.guardian_relation,
        guardian_phone=req.guardian_phone or patient.guardian_phone or patient.emergency_contact_phone,
        is_cashless=req.is_cashless,
        mediclaim_provider=req.mediclaim_provider,
        mediclaim_policy_number=req.mediclaim_policy_number,
        created_by_id=current_user.id,
    )
    bed.status = BedStatus.OCCUPIED.value
    db.add(admission)
    db.commit()
    db.refresh(admission)

    loaded = (
        db.query(Admission)
        .options(
            joinedload(Admission.patient).joinedload(PatientProfile.user),
            joinedload(Admission.doctor),
            joinedload(Admission.bed).joinedload(Bed.ward),
        )
        .filter(Admission.id == admission.id)
        .first()
    )
    return _serialize_admission(loaded)


@router.get("/{admission_id}", response_model=AdmissionDetailResponse)
def get_admission_detail(
    admission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    adm = (
        db.query(Admission)
        .options(
            joinedload(Admission.patient).joinedload(PatientProfile.user),
            joinedload(Admission.doctor),
            joinedload(Admission.bed).joinedload(Bed.ward),
            joinedload(Admission.notes).joinedload(InpatientNote.recorded_by),
        )
        .filter(Admission.id == admission_id)
        .first()
    )
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    if current_user.role == UserRole.PATIENT.value:
        patient = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if not patient or adm.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Access denied")

    summary = _serialize_admission(adm)
    notes_resp = [
        InpatientNoteResponse(
            id=n.id,
            admission_id=n.admission_id,
            recorded_by_id=n.recorded_by_id,
            recorded_by_name=n.recorded_by.email if n.recorded_by else None,
            note_type=n.note_type,
            temperature_f=n.temperature_f,
            pulse_bpm=n.pulse_bpm,
            respiratory_rate=n.respiratory_rate,
            spo2_percent=n.spo2_percent,
            weight_kg=n.weight_kg,
            notes=n.notes,
            recorded_at=n.recorded_at,
        )
        for n in adm.notes
    ]
    return AdmissionDetailResponse(**summary.model_dump(), notes=notes_resp)


@router.post("/{admission_id}/transfer", response_model=AdmissionSummaryResponse)
def transfer_admission_bed(
    admission_id: str,
    req: AdmissionTransferRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if adm.status != AdmissionStatus.ADMITTED.value:
        raise HTTPException(status_code=400, detail="Only admitted patients can be transferred")

    new_bed = db.query(Bed).filter(Bed.id == req.new_bed_id).first()
    if not new_bed:
        raise HTTPException(status_code=404, detail="Target bed not found")
    if new_bed.status != BedStatus.AVAILABLE.value:
        raise HTTPException(status_code=409, detail=f"Target bed {new_bed.bed_number} is {new_bed.status}")

    old_bed_num = None
    if adm.bed_id:
        old_bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
        if old_bed:
            old_bed_num = old_bed.bed_number
            old_bed.status = BedStatus.CLEANING.value

    new_bed.status = BedStatus.OCCUPIED.value
    adm.bed_id = new_bed.id
    adm.updated_by_id = current_user.id

    note = InpatientNote(
        admission_id=adm.id,
        recorded_by_id=current_user.id,
        note_type="PROCEDURE",
        notes=f"Bed transferred from {old_bed_num or 'N/A'} to {new_bed.bed_number}." + (f" Reason: {req.reason}" if req.reason else ""),
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(note)
    db.commit()

    loaded = (
        db.query(Admission)
        .options(
            joinedload(Admission.patient).joinedload(PatientProfile.user),
            joinedload(Admission.doctor),
            joinedload(Admission.bed).joinedload(Bed.ward),
        )
        .filter(Admission.id == adm.id)
        .first()
    )
    return _serialize_admission(loaded)


@router.post("/{admission_id}/notes", response_model=InpatientNoteResponse, status_code=status.HTTP_201_CREATED)
def add_inpatient_note(
    admission_id: str,
    req: InpatientNoteCreateRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")

    note = InpatientNote(
        admission_id=admission_id,
        recorded_by_id=current_user.id,
        note_type=req.note_type,
        temperature_f=req.temperature_f,
        pulse_bpm=req.pulse_bpm,
        respiratory_rate=req.respiratory_rate,
        spo2_percent=req.spo2_percent,
        weight_kg=req.weight_kg,
        notes=req.notes,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return InpatientNoteResponse(
        id=note.id,
        admission_id=note.admission_id,
        recorded_by_id=note.recorded_by_id,
        recorded_by_name=current_user.email,
        note_type=note.note_type,
        temperature_f=note.temperature_f,
        pulse_bpm=note.pulse_bpm,
        respiratory_rate=note.respiratory_rate,
        spo2_percent=note.spo2_percent,
        weight_kg=note.weight_kg,
        notes=note.notes,
        recorded_at=note.recorded_at,
    )


@router.post("/{admission_id}/discharge", response_model=AdmissionSummaryResponse)
def discharge_patient(
    admission_id: str,
    req: AdmissionDischargeRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if adm.status != AdmissionStatus.ADMITTED.value:
        raise HTTPException(status_code=400, detail="Patient is not currently admitted")

    adm.status = AdmissionStatus.DISCHARGED.value
    adm.discharged_at = datetime.now(timezone.utc)
    adm.discharge_diagnosis = req.discharge_diagnosis
    adm.treatment_summary = req.treatment_summary
    adm.discharge_medications = req.discharge_medications
    adm.follow_up_instructions = req.follow_up_instructions
    adm.follow_up_date = req.follow_up_date
    adm.updated_by_id = current_user.id

    if adm.bed_id:
        bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
        if bed:
            bed.status = BedStatus.CLEANING.value

    if req.follow_up_date:
        follow_up = FollowUp(
            patient_id=adm.patient_id,
            recommended_date=req.follow_up_date,
            reason=f"Post-discharge follow-up ({adm.admission_number}): {req.discharge_diagnosis}",
            status=FollowUpStatus.PENDING.value,
        )
        db.add(follow_up)

    db.commit()

    loaded = (
        db.query(Admission)
        .options(
            joinedload(Admission.patient).joinedload(PatientProfile.user),
            joinedload(Admission.doctor),
            joinedload(Admission.bed).joinedload(Bed.ward),
        )
        .filter(Admission.id == adm.id)
        .first()
    )
    return _serialize_admission(loaded)
