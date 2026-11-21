from datetime import time, date
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.profile import DoctorProfile, StaffProfile, PatientProfile
from app.models.service import Service, DoctorAvailability, ClinicSetting
from app.models.admission import Ward, Bed, WardType, BedStatus


def seed_database(db: Session = None):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        # 1. Hospital Settings
        existing_setting = db.query(ClinicSetting).first()
        if not existing_setting:
            setting = ClinicSetting(
                clinic_name="Nidaan Children Hospital",
                tagline="Compassionate Pediatric & Neonatal Care in Manjalpur, Vadodara — OPD, Vaccination, Emergency & Inpatient Admissions.",
                phone_primary="+91 94263 22819",
                phone_secondary="+91 82001 22052",
                phone_landline="0265-2644217",
                email="contact@nidaanchildrenhospital.com",
                address="303-305 & 4th Floor, Veer Enclave, Near Tulsidham Char Rasta, Manjalpur, Vadodara - 390011, Gujarat, India",
                google_maps_url="https://maps.google.com/maps?q=Nidaan%20Children%20Hospital,%20Veer%20Enclave,%20Manjalpur,%20Vadodara%20-%20390011&t=m&z=14&ie=UTF8&output=embed",
                booking_buffer_minutes=15,
                max_advance_booking_days=30,
            )
            db.add(setting)
            db.commit()

        # 2. Pediatric Services
        services_data = [
            {
                "name": "OPD Consultation",
                "slug": "opd-consultation",
                "category": "OPD",
                "description": "Comprehensive outpatient pediatric consultation for fever, infections, respiratory issues, allergies, and general child health.",
                "duration_minutes": 20,
                "display_order": 1,
            },
            {
                "name": "Vaccination Services",
                "slug": "vaccination-services",
                "category": "Immunization",
                "description": "Complete immunization schedules from birth to adolescence including routine IAP/WHO vaccines, boosters, and optional vaccines.",
                "duration_minutes": 20,
                "display_order": 2,
            },
            {
                "name": "Well Baby Clinic",
                "slug": "well-baby-clinic",
                "category": "Preventive",
                "description": "Preventive newborn & infant care, growth monitoring (weight/height), milestone screening, and feeding guidance.",
                "duration_minutes": 30,
                "display_order": 3,
            },
            {
                "name": "Emergency Pediatric Care",
                "slug": "emergency-pediatric-care",
                "category": "Emergency",
                "description": "Urgent triage, stabilization, nebulization, IV fluid therapy, and immediate inpatient admission support for acute pediatric conditions.",
                "duration_minutes": 30,
                "display_order": 4,
            },
            {
                "name": "Child & Parental Counseling",
                "slug": "child-parental-counseling",
                "category": "Counseling",
                "description": "Supportive guidance for behavioral, developmental, school-readiness, and emotional challenges in children and adolescents.",
                "duration_minutes": 45,
                "display_order": 5,
            },
            {
                "name": "Diet Counseling for Children",
                "slug": "diet-counseling",
                "category": "Nutrition",
                "description": "Tailored pediatric nutrition plans for fussy eaters, underweight/overweight children, and post-illness recovery.",
                "duration_minutes": 30,
                "display_order": 6,
            },
            {
                "name": "Inpatient Admission (IPD)",
                "slug": "inpatient-admission",
                "category": "IPD",
                "description": "24x7 monitored pediatric inpatient care across General Ward, Semi-Private, and Private Rooms with cashless mediclaim support.",
                "duration_minutes": 30,
                "display_order": 7,
            },
        ]

        for s_data in services_data:
            existing = db.query(Service).filter(Service.slug == s_data["slug"]).first()
            if not existing:
                db.add(Service(**s_data))
        db.commit()

        # 3. Staff Users & Profiles
        admin_user = db.query(User).filter(User.email == "admin@nidaanchildrenhospital.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@nidaanchildrenhospital.com",
                password_hash=hash_password("NidaanAdmin@2026"),
                role=UserRole.ADMIN.value,
                is_active=True,
                is_verified=True,
            )
            db.add(admin_user)
            db.flush()
            db.add(StaffProfile(
                user_id=admin_user.id,
                first_name="Hospital",
                last_name="Administrator",
                department="Management",
            ))

        rec_user = db.query(User).filter(User.email == "reception@nidaanchildrenhospital.com").first()
        if not rec_user:
            rec_user = User(
                email="reception@nidaanchildrenhospital.com",
                password_hash=hash_password("Reception@2026"),
                role=UserRole.RECEPTIONIST.value,
                is_active=True,
                is_verified=True,
            )
            db.add(rec_user)
            db.flush()
            db.add(StaffProfile(
                user_id=rec_user.id,
                first_name="Nidaan",
                last_name="Front Desk",
                department="OPD & IPD Desk",
            ))

        # 4. Pediatricians (from nidaanchildrenhospital.com)
        doctors_seed = [
            {
                "email": "dr.ravindra@nidaanchildrenhospital.com",
                "password": "DrRavindra@2026",
                "full_name": "Dr. Ravindra Pradhan",
                "qualification": "M.D. (Pediatrics), Baroda Medical College",
                "registration_number": "GMC-VAD-1995-2104",
                "specialization": "Senior Pediatrician & Neonatologist",
                "experience_years": 28,
                "bio": "Practicing since 1995 with over 25 years of experience in general pediatrics, newborn care, and neonatology.",
            },
            {
                "email": "dr.valay@nidaanchildrenhospital.com",
                "password": "DrValay@2026",
                "full_name": "Dr. Valay Jain",
                "qualification": "DCH (Pediatrics), B.J. Medical College, Ahmedabad",
                "registration_number": "GMC-VAD-2012-4418",
                "specialization": "Consultant Pediatrician & Infectious Diseases",
                "experience_years": 14,
                "bio": "Pediatric specialist with special interest in pediatric infectious diseases, immunization, and outpatient child care.",
            },
            {
                "email": "dr.rachana@nidaanchildrenhospital.com",
                "password": "DrRachana@2026",
                "full_name": "Dr. Rachana Durgai",
                "qualification": "DCH (Pediatrics), DNB (Pediatrics)",
                "registration_number": "GMC-VAD-2016-5892",
                "specialization": "Pediatric Intensivist & Newborn Care Specialist",
                "experience_years": 10,
                "bio": "Experienced in managing critical pediatric patients (PICU) and newborn/delivery care.",
            },
        ]

        for d in doctors_seed:
            doc_user = db.query(User).filter(User.email == d["email"]).first()
            if not doc_user:
                doc_user = User(
                    email=d["email"],
                    password_hash=hash_password(d["password"]),
                    role=UserRole.DOCTOR.value,
                    is_active=True,
                    is_verified=True,
                )
                db.add(doc_user)
                db.flush()
                doc_profile = DoctorProfile(
                    user_id=doc_user.id,
                    full_name=d["full_name"],
                    qualification=d["qualification"],
                    registration_number=d["registration_number"],
                    specialization=d["specialization"],
                    experience_years=d["experience_years"],
                    bio=d["bio"],
                )
                db.add(doc_profile)
                db.flush()

                # Mon-Sat 09:00-13:00 and 16:30-20:30
                for day in range(1, 7):
                    db.add(DoctorAvailability(
                        doctor_id=doc_profile.id,
                        day_of_week=day,
                        start_time=time(9, 0),
                        end_time=time(13, 0),
                        slot_duration_minutes=20,
                    ))
                    db.add(DoctorAvailability(
                        doctor_id=doc_profile.id,
                        day_of_week=day,
                        start_time=time(16, 30),
                        end_time=time(20, 30),
                        slot_duration_minutes=20,
                    ))

        # 5. Wards & Beds (General Ward, Semi-Private, Private Room)
        wards_seed = [
            {
                "name": "General Ward",
                "ward_type": WardType.GENERAL.value,
                "floor": "3rd Floor",
                "daily_rate": 1200.0,
                "description": "Multi-bed pediatric ward with 24x7 nursing supervision.",
                "beds": ["GW-101", "GW-102", "GW-103", "GW-104", "GW-105", "GW-106"],
            },
            {
                "name": "Semi-Private",
                "ward_type": WardType.SEMI_PRIVATE.value,
                "floor": "3rd Floor",
                "daily_rate": 2200.0,
                "description": "Twin-sharing AC pediatric rooms with attendant seating.",
                "beds": ["SP-201", "SP-202", "SP-203", "SP-204"],
            },
            {
                "name": "Private Room",
                "ward_type": WardType.PRIVATE.value,
                "floor": "4th Floor",
                "daily_rate": 3800.0,
                "description": "Single-occupancy AC suite with dedicated attendant bed & attached bath.",
                "beds": ["PR-301", "PR-302", "PR-303", "PR-304"],
            },
        ]

        for w_data in wards_seed:
            ward = db.query(Ward).filter(Ward.name == w_data["name"]).first()
            if not ward:
                ward = Ward(
                    name=w_data["name"],
                    ward_type=w_data["ward_type"],
                    floor=w_data["floor"],
                    daily_rate=w_data["daily_rate"],
                    description=w_data["description"],
                )
                db.add(ward)
                db.flush()
                for bed_num in w_data["beds"]:
                    db.add(Bed(ward_id=ward.id, bed_number=bed_num, status=BedStatus.AVAILABLE.value))

        # 6. Pre-registered pediatric patient for testing
        patient_user = db.query(User).filter(User.phone == "+919876543210").first()
        if not patient_user:
            patient_user = User(
                phone="+919876543210",
                role=UserRole.PATIENT.value,
                is_active=True,
                is_verified=True,
            )
            db.add(patient_user)
            db.flush()
            db.add(PatientProfile(
                user_id=patient_user.id,
                first_name="Aarav",
                last_name="Patel",
                date_of_birth=date(2022, 5, 15),
                gender="Male",
                blood_group="B+",
                guardian_name="Ramesh Patel",
                guardian_relation="Father",
                guardian_phone="+919876543210",
                weight_kg=16.5,
                height_cm=102.0,
                city="Vadodara",
                address="Near Tulsidham Char Rasta, Manjalpur, Vadodara",
                allergies="None",
            ))

        db.commit()
        print("Database seed completed successfully for Nidaan Children Hospital.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    seed_database()
