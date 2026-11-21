from datetime import date


def _staff_headers(client):
    res = client.post(
        "/api/v1/auth/staff/login",
        json={"email": "dr.ravindra@nidaanchildrenhospital.com", "password": "DrRavindra@2026"},
    )
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_wards_and_beds_seeded(client):
    headers = _staff_headers(client)
    res = client.get("/api/v1/admissions/wards", headers=headers)
    assert res.status_code == 200, res.text
    wards = res.json()
    names = {w["name"] for w in wards}
    assert {"General Ward", "Semi-Private", "Private Room"}.issubset(names)
    total_beds = sum(w["total_beds"] for w in wards)
    assert total_beds >= 14


def test_full_admission_transfer_notes_billing_and_discharge(client):
    headers = _staff_headers(client)

    # Get patient, doctor, and available beds
    patients = client.get("/api/v1/admin/patients", headers=headers).json()["items"]
    assert len(patients) >= 1
    patient_id = patients[0]["id"]

    doctors = client.get("/api/v1/services/doctors").json()
    assert len(doctors) >= 3
    doctor_id = doctors[0]["id"]

    wards = client.get("/api/v1/admissions/wards", headers=headers).json()
    general_ward = next(w for w in wards if w["ward_type"] == "GENERAL")
    private_ward = next(w for w in wards if w["ward_type"] == "PRIVATE")
    bed1_id = general_ward["beds"][0]["id"]
    bed2_id = private_ward["beds"][0]["id"]

    # 1. Admit patient
    adm_res = client.post(
        "/api/v1/admissions",
        headers=headers,
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "bed_id": bed1_id,
            "admission_type": "DIRECT",
            "chief_complaints": "High fever and cough for 3 days",
            "admission_diagnosis": "Acute Bronchiolitis",
            "is_cashless": True,
            "mediclaim_provider": "Star Health",
            "mediclaim_policy_number": "SH-998877",
        },
    )
    assert adm_res.status_code == 201, adm_res.text
    adm = adm_res.json()
    assert adm["status"] == "ADMITTED"
    assert adm["bed_id"] == bed1_id

    # 2. Add inpatient vitals / doctor round note
    note_res = client.post(
        f"/api/v1/admissions/{adm['id']}/notes",
        headers=headers,
        json={
            "note_type": "NURSING_VITALS",
            "temperature_f": 100.4,
            "pulse_bpm": 112,
            "spo2_percent": 98,
            "weight_kg": 16.5,
            "notes": "Nebulization given, vitals stable.",
        },
    )
    assert note_res.status_code == 201, note_res.text

    # 3. Transfer bed to Private Room
    tr_res = client.post(
        f"/api/v1/admissions/{adm['id']}/transfer",
        headers=headers,
        json={"new_bed_id": bed2_id, "reason": "Parent requested Private Room"},
    )
    assert tr_res.status_code == 200, tr_res.text
    assert tr_res.json()["bed_id"] == bed2_id

    # 4. Create IPD invoice & record payment
    inv_res = client.post(
        "/api/v1/billing/invoices",
        headers=headers,
        json={
            "patient_id": patient_id,
            "admission_id": adm["id"],
            "billing_type": "IPD",
            "discount_amount": 200.0,
            "paid_amount": 2000.0,
            "payment_method": "UPI",
            "items": [
                {"description": "Private Room Charges (1 Day)", "category": "BED_CHARGE", "quantity": 1, "unit_price": 3800.0},
                {"description": "Pediatrician Round Fee", "category": "CONSULTATION", "quantity": 1, "unit_price": 800.0},
            ],
        },
    )
    assert inv_res.status_code == 201, inv_res.text
    inv = inv_res.json()
    assert inv["total_amount"] == 4400.0
    assert inv["status"] == "PARTIALLY_PAID"

    pay_res = client.post(
        f"/api/v1/billing/invoices/{inv['id']}/pay",
        headers=headers,
        json={"amount": 2400.0, "payment_method": "CARD"},
    )
    assert pay_res.status_code == 200, pay_res.text
    assert pay_res.json()["status"] == "PAID"

    # 5. Discharge patient
    dis_res = client.post(
        f"/api/v1/admissions/{adm['id']}/discharge",
        headers=headers,
        json={
            "discharge_diagnosis": "Resolved Acute Bronchiolitis",
            "treatment_summary": "IV fluids, nebulization, and supportive pediatric care.",
            "discharge_medications": "Syrup Azithromycin 200mg OD x 3 days",
            "follow_up_instructions": "Review in OPD after 5 days.",
            "follow_up_date": date.today().isoformat(),
        },
    )
    assert dis_res.status_code == 200, dis_res.text
    assert dis_res.json()["status"] == "DISCHARGED"
