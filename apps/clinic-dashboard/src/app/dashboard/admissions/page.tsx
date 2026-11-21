"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BedDouble,
  Plus,
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  Printer,
  X,
  FileCheck,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

export default function AdmissionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"beds" | "admitted" | "discharged">("beds");
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "notes" | "discharge">("overview");

  // Admit Form State
  const [admitForm, setAdmitForm] = useState({
    patient_id: "",
    doctor_id: "",
    bed_id: "",
    admission_type: "DIRECT",
    chief_complaints: "",
    admission_diagnosis: "",
    guardian_name: "",
    guardian_relation: "Father",
    guardian_phone: "",
    is_cashless: false,
    mediclaim_provider: "",
    mediclaim_policy_number: "",
  });

  // Note Form State
  const [noteForm, setNoteForm] = useState({
    note_type: "DOCTOR_ROUND",
    temperature_f: "",
    pulse_bpm: "",
    respiratory_rate: "",
    spo2_percent: "",
    weight_kg: "",
    notes: "",
  });

  // Transfer State
  const [transferBedId, setTransferBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Discharge Form State
  const [dischargeForm, setDischargeForm] = useState({
    discharge_diagnosis: "",
    treatment_summary: "",
    discharge_medications: "",
    follow_up_instructions: "",
    follow_up_date: "",
  });

  const { data: wards = [], isLoading: loadingWards } = useQuery({
    queryKey: ["wards"],
    queryFn: () => api.getWards(),
  });

  const { data: admissions = [], isLoading: loadingAdmissions } = useQuery({
    queryKey: ["admissions"],
    queryFn: () => api.getAdmissions(),
  });

  const { data: patientsData } = useQuery({
    queryKey: ["patientsForAdmit"],
    queryFn: () => api.getPatients("", 1, 100),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.getDoctors(),
  });

  const { data: admissionDetail } = useQuery({
    queryKey: ["admissionDetail", selectedAdmissionId],
    queryFn: () => api.getAdmissionDetail(selectedAdmissionId!),
    enabled: !!selectedAdmissionId,
  });

  const allAvailableBeds = wards.flatMap((w: any) =>
    (w.beds || [])
      .filter((b: any) => b.status === "AVAILABLE")
      .map((b: any) => ({ ...b, ward_name: w.name, daily_rate: w.daily_rate }))
  );

  const admitMutation = useMutation({
    mutationFn: (payload: any) => api.createAdmission(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wards"] });
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardKpis"] });
      setShowAdmitModal(false);
      setAdmitForm({
        patient_id: "",
        doctor_id: "",
        bed_id: "",
        admission_type: "DIRECT",
        chief_complaints: "",
        admission_diagnosis: "",
        guardian_name: "",
        guardian_relation: "Father",
        guardian_phone: "",
        is_cashless: false,
        mediclaim_provider: "",
        mediclaim_policy_number: "",
      });
    },
  });

  const bedStatusMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api.updateBedStatus(bedId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wards"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardKpis"] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (payload: any) => api.addInpatientNote(selectedAdmissionId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admissionDetail", selectedAdmissionId] });
      setNoteForm({
        note_type: "DOCTOR_ROUND",
        temperature_f: "",
        pulse_bpm: "",
        respiratory_rate: "",
        spo2_percent: "",
        weight_kg: "",
        notes: "",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: () => api.transferAdmissionBed(selectedAdmissionId!, transferBedId, transferReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wards"] });
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["admissionDetail", selectedAdmissionId] });
      setTransferBedId("");
      setTransferReason("");
    },
  });

  const dischargeMutation = useMutation({
    mutationFn: (payload: any) => api.dischargeAdmission(selectedAdmissionId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wards"] });
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      queryClient.invalidateQueries({ queryKey: ["admissionDetail", selectedAdmissionId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardKpis"] });
    },
  });

  const activeAdmissions = admissions.filter((a: any) => a.status === "ADMITTED");
  const dischargedAdmissions = admissions.filter((a: any) => a.status === "DISCHARGED");

  const getBedBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 border-emerald-200 text-emerald-700";
      case "OCCUPIED":
        return "bg-rose-50 border-rose-200 text-rose-700";
      case "CLEANING":
        return "bg-amber-50 border-amber-200 text-amber-700";
      default:
        return "bg-slate-100 border-slate-200 text-slate-600";
    }
  };

  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    admitMutation.mutate(admitForm);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    addNoteMutation.mutate({
      note_type: noteForm.note_type,
      temperature_f: noteForm.temperature_f ? parseFloat(noteForm.temperature_f) : undefined,
      pulse_bpm: noteForm.pulse_bpm ? parseInt(noteForm.pulse_bpm, 10) : undefined,
      respiratory_rate: noteForm.respiratory_rate ? parseInt(noteForm.respiratory_rate, 10) : undefined,
      spo2_percent: noteForm.spo2_percent ? parseInt(noteForm.spo2_percent, 10) : undefined,
      weight_kg: noteForm.weight_kg ? parseFloat(noteForm.weight_kg) : undefined,
      notes: noteForm.notes,
    });
  };

  const handleDischarge = (e: React.FormEvent) => {
    e.preventDefault();
    dischargeMutation.mutate({
      ...dischargeForm,
      follow_up_date: dischargeForm.follow_up_date || null,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            IPD Admissions & Bed Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Nidaan Children Hospital • General Ward, Semi-Private & Private Room Management
          </p>
        </div>
        <button
          onClick={() => setShowAdmitModal(true)}
          className="px-4 py-2.5 text-xs font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-md shadow-teal-600/20 flex items-center gap-2 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          New Patient Admission
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("beds")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "beds"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Ward & Bed Board
        </button>
        <button
          onClick={() => setActiveTab("admitted")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "admitted"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Active Admissions ({activeAdmissions.length})
        </button>
        <button
          onClick={() => setActiveTab("discharged")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "discharged"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Discharged History ({dischargedAdmissions.length})
        </button>
      </div>

      {/* Tab 1: Ward & Bed Board */}
      {activeTab === "beds" && (
        <div className="space-y-6">
          {loadingWards ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading wards & beds...</div>
          ) : (
            wards.map((ward: any) => (
              <div key={ward.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-teal-600" />
                      {ward.name}
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {ward.floor}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{ward.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-semibold text-slate-700">₹{ward.daily_rate}/day</span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      {ward.available_beds} Available / {ward.total_beds} Total
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(ward.beds || []).map((bed: any) => (
                    <div
                      key={bed.id}
                      onClick={() => {
                        if (bed.current_admission_id) {
                          setSelectedAdmissionId(bed.current_admission_id);
                          setDetailTab("overview");
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all ${getBedBadge(bed.status)} ${
                        bed.current_admission_id ? "cursor-pointer hover:shadow-md" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{bed.bed_number}</span>
                        <span className="text-[10px] font-bold uppercase">{bed.status}</span>
                      </div>
                      {bed.current_patient_name ? (
                        <p className="text-xs font-semibold mt-2 truncate">{bed.current_patient_name}</p>
                      ) : (
                        <p className="text-[11px] opacity-75 mt-2">
                          {bed.status === "AVAILABLE" ? "Ready for admission" : "Action required"}
                        </p>
                      )}
                      {bed.status === "CLEANING" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            bedStatusMutation.mutate({ bedId: bed.id, status: "AVAILABLE" });
                          }}
                          className="mt-2 w-full py-1 text-[10px] font-semibold bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100"
                        >
                          Mark Available
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2 & 3: Active / Discharged Admissions List */}
      {(activeTab === "admitted" || activeTab === "discharged") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loadingAdmissions ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading admissions...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">IPD No.</th>
                    <th className="py-3 px-4">Child / Patient</th>
                    <th className="py-3 px-4">Ward & Bed</th>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Diagnosis</th>
                    <th className="py-3 px-4">Mediclaim</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {(activeTab === "admitted" ? activeAdmissions : dischargedAdmissions).map((adm: any) => (
                    <tr key={adm.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{adm.admission_number}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{adm.patient_name}</p>
                        <p className="text-[11px] text-slate-500">{adm.patient_phone || "No phone"}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-teal-700">{adm.ward_name || "-"}</span>
                        <span className="block text-[11px] text-slate-500">Bed {adm.bed_number || "-"}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{adm.doctor_name}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{adm.admission_diagnosis}</td>
                      <td className="py-3 px-4">
                        {adm.is_cashless ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            {adm.mediclaim_provider || "Cashless"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Self-Pay</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedAdmissionId(adm.id);
                            setDetailTab("overview");
                          }}
                          className="px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-semibold text-xs"
                        >
                          Manage / Summary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: New Admission */}
      {showAdmitModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Admit Child to IPD</h2>
              <button onClick={() => setShowAdmitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdmitSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Patient *</label>
                  <select
                    required
                    value={admitForm.patient_id}
                    onChange={(e) => setAdmitForm({ ...admitForm, patient_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="">Select child patient...</option>
                    {(patientsData?.items || []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.phone || "No phone"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attending Pediatrician *</label>
                  <select
                    required
                    value={admitForm.doctor_id}
                    onChange={(e) => setAdmitForm({ ...admitForm, doctor_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="">Select doctor...</option>
                    {doctors.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ward & Available Bed *</label>
                  <select
                    required
                    value={admitForm.bed_id}
                    onChange={(e) => setAdmitForm({ ...admitForm, bed_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="">Select available bed...</option>
                    {allAvailableBeds.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.ward_name} — Bed {b.bed_number} (₹{b.daily_rate}/day)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Admission Type</label>
                  <select
                    value={admitForm.admission_type}
                    onChange={(e) => setAdmitForm({ ...admitForm, admission_type: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="DIRECT">Direct Admission</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="OPD_CONVERTED">OPD Converted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Provisional / Admission Diagnosis *</label>
                <input
                  type="text"
                  required
                  value={admitForm.admission_diagnosis}
                  onChange={(e) => setAdmitForm({ ...admitForm, admission_diagnosis: e.target.value })}
                  placeholder="e.g., Acute Bronchiolitis / Dengue Fever / Dehydration"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chief Complaints</label>
                <textarea
                  rows={2}
                  value={admitForm.chief_complaints}
                  onChange={(e) => setAdmitForm({ ...admitForm, chief_complaints: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
                  <input
                    type="text"
                    value={admitForm.guardian_name}
                    onChange={(e) => setAdmitForm({ ...admitForm, guardian_name: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Relation</label>
                  <input
                    type="text"
                    value={admitForm.guardian_relation}
                    onChange={(e) => setAdmitForm({ ...admitForm, guardian_relation: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Guardian Phone</label>
                  <input
                    type="text"
                    value={admitForm.guardian_phone}
                    onChange={(e) => setAdmitForm({ ...admitForm, guardian_phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
                <label className="flex items-center gap-2 font-semibold text-indigo-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={admitForm.is_cashless}
                    onChange={(e) => setAdmitForm({ ...admitForm, is_cashless: e.target.checked })}
                  />
                  Cashless / Mediclaim Admission
                </label>
                {admitForm.is_cashless && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Insurance Provider (e.g. Star Health)"
                      value={admitForm.mediclaim_provider}
                      onChange={(e) => setAdmitForm({ ...admitForm, mediclaim_provider: e.target.value })}
                      className="p-2 border border-indigo-200 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Policy / TPA Number"
                      value={admitForm.mediclaim_policy_number}
                      onChange={(e) => setAdmitForm({ ...admitForm, mediclaim_policy_number: e.target.value })}
                      className="p-2 border border-indigo-200 rounded-lg bg-white"
                    />
                  </div>
                )}
              </div>

              {admitMutation.error && (
                <p className="text-rose-600 font-semibold">{(admitMutation.error as Error).message}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={admitMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700"
                >
                  {admitMutation.isPending ? "Admitting..." : "Confirm Admission"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admission Detail / Vitals / Transfer / Discharge Summary */}
      {selectedAdmissionId && admissionDetail && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 print:hidden">
              <div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                  {admissionDetail.admission_number} • {admissionDetail.status}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{admissionDetail.patient_name}</h2>
                <p className="text-xs text-slate-500">
                  {admissionDetail.ward_name} (Bed {admissionDetail.bed_number}) • {admissionDetail.doctor_name}
                </p>
              </div>
              <button onClick={() => setSelectedAdmissionId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-slate-200 print:hidden">
              <button
                onClick={() => setDetailTab("overview")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 ${
                  detailTab === "overview" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500"
                }`}
              >
                Overview & Bed Transfer
              </button>
              <button
                onClick={() => setDetailTab("notes")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 ${
                  detailTab === "notes" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500"
                }`}
              >
                Vitals & Round Notes ({admissionDetail.notes?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab("discharge")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 ${
                  detailTab === "discharge" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500"
                }`}
              >
                Discharge & Summary
              </button>
            </div>

            {detailTab === "overview" && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-slate-400">Admitted At</span>
                    <p className="font-semibold text-slate-800">
                      {new Date(admissionDetail.admitted_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Diagnosis</span>
                    <p className="font-semibold text-slate-800">{admissionDetail.admission_diagnosis}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Guardian</span>
                    <p className="font-semibold text-slate-800">
                      {admissionDetail.guardian_name || "-"} ({admissionDetail.guardian_phone || "-"})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Mediclaim</span>
                    <p className="font-semibold text-slate-800">
                      {admissionDetail.is_cashless
                        ? `${admissionDetail.mediclaim_provider || "Cashless"} (${admissionDetail.mediclaim_policy_number || "N/A"})`
                        : "Self-Pay"}
                    </p>
                  </div>
                </div>

                {admissionDetail.status === "ADMITTED" && (
                  <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                    <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-teal-600" />
                      Transfer Bed / Ward
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={transferBedId}
                        onChange={(e) => setTransferBedId(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg bg-slate-50"
                      >
                        <option value="">Select new available bed...</option>
                        {allAvailableBeds.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.ward_name} — Bed {b.bed_number} (₹{b.daily_rate}/day)
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Reason for transfer"
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg bg-slate-50"
                      />
                    </div>
                    <button
                      disabled={!transferBedId || transferMutation.isPending}
                      onClick={() => transferMutation.mutate()}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold disabled:opacity-50"
                    >
                      {transferMutation.isPending ? "Transferring..." : "Confirm Bed Transfer"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {detailTab === "notes" && (
              <div className="space-y-4 text-xs">
                {admissionDetail.status === "ADMITTED" && (
                  <form onSubmit={handleAddNote} className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <select
                        value={noteForm.note_type}
                        onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}
                        className="p-2 border border-slate-200 rounded-lg bg-white col-span-2 sm:col-span-1"
                      >
                        <option value="DOCTOR_ROUND">Doctor Round</option>
                        <option value="NURSING_VITALS">Nursing Vitals</option>
                        <option value="MEDICATION">Medication</option>
                        <option value="PROCEDURE">Procedure</option>
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Temp (°F)"
                        value={noteForm.temperature_f}
                        onChange={(e) => setNoteForm({ ...noteForm, temperature_f: e.target.value })}
                        className="p-2 border border-slate-200 rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        placeholder="Pulse (bpm)"
                        value={noteForm.pulse_bpm}
                        onChange={(e) => setNoteForm({ ...noteForm, pulse_bpm: e.target.value })}
                        className="p-2 border border-slate-200 rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        placeholder="SpO2 (%)"
                        value={noteForm.spo2_percent}
                        onChange={(e) => setNoteForm({ ...noteForm, spo2_percent: e.target.value })}
                        className="p-2 border border-slate-200 rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Weight (kg)"
                        value={noteForm.weight_kg}
                        onChange={(e) => setNoteForm({ ...noteForm, weight_kg: e.target.value })}
                        className="p-2 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <textarea
                      required
                      rows={2}
                      placeholder="Clinical progress / nursing observation / medication notes..."
                      value={noteForm.notes}
                      onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-lg bg-white"
                    />
                    <button
                      type="submit"
                      disabled={addNoteMutation.isPending}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold"
                    >
                      Add Inpatient Note
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {(admissionDetail.notes || []).map((n: any) => (
                    <div key={n.id} className="p-3 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-teal-700">{n.note_type}</span>
                        <span>{new Date(n.recorded_at).toLocaleString()}</span>
                      </div>
                      {(n.temperature_f || n.pulse_bpm || n.spo2_percent || n.weight_kg) && (
                        <div className="flex gap-3 mt-1 text-[11px] font-semibold text-slate-700">
                          {n.temperature_f && <span>Temp: {n.temperature_f}°F</span>}
                          {n.pulse_bpm && <span>Pulse: {n.pulse_bpm} bpm</span>}
                          {n.spo2_percent && <span>SpO2: {n.spo2_percent}%</span>}
                          {n.weight_kg && <span>Wt: {n.weight_kg} kg</span>}
                        </div>
                      )}
                      <p className="mt-1 text-slate-800">{n.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailTab === "discharge" && (
              <div className="space-y-4 text-xs">
                {admissionDetail.status === "DISCHARGED" ? (
                  <div className="space-y-4">
                    <div className="p-5 border border-slate-200 rounded-xl space-y-3 bg-white">
                      <div className="text-center border-b border-slate-200 pb-3">
                        <h3 className="text-base font-bold text-slate-900">NIDAAN CHILDREN HOSPITAL</h3>
                        <p className="text-[11px] text-slate-500">
                          303-305 & 4th Floor, Veer Enclave, Near Tulsidham Char Rasta, Manjalpur, Vadodara - 390011
                        </p>
                        <p className="text-xs font-bold text-teal-700 mt-1">DISCHARGE SUMMARY</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <p><strong>IPD No:</strong> {admissionDetail.admission_number}</p>
                        <p><strong>Patient:</strong> {admissionDetail.patient_name}</p>
                        <p><strong>Doctor:</strong> {admissionDetail.doctor_name}</p>
                        <p><strong>Admitted:</strong> {new Date(admissionDetail.admitted_at).toLocaleDateString()}</p>
                        <p><strong>Discharged:</strong> {admissionDetail.discharged_at ? new Date(admissionDetail.discharged_at).toLocaleDateString() : "-"}</p>
                        <p><strong>Ward / Bed:</strong> {admissionDetail.ward_name} ({admissionDetail.bed_number})</p>
                      </div>
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <p><strong>Final Diagnosis:</strong> {admissionDetail.discharge_diagnosis}</p>
                        <p><strong>Treatment Given:</strong> {admissionDetail.treatment_summary}</p>
                        <p><strong>Discharge Medications:</strong> {admissionDetail.discharge_medications || "-"}</p>
                        <p><strong>Follow-up Instructions:</strong> {admissionDetail.follow_up_instructions || "-"}</p>
                        {admissionDetail.follow_up_date && (
                          <p><strong>Next OPD Follow-up Date:</strong> {admissionDetail.follow_up_date}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end print:hidden">
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Print Discharge Summary
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleDischarge} className="space-y-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Final Discharge Diagnosis *</label>
                      <input
                        type="text"
                        required
                        value={dischargeForm.discharge_diagnosis}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_diagnosis: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Treatment Summary *</label>
                      <textarea
                        rows={3}
                        required
                        value={dischargeForm.treatment_summary}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, treatment_summary: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Discharge Medications</label>
                      <textarea
                        rows={2}
                        value={dischargeForm.discharge_medications}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_medications: e.target.value })}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Follow-up Instructions</label>
                        <input
                          type="text"
                          value={dischargeForm.follow_up_instructions}
                          onChange={(e) => setDischargeForm({ ...dischargeForm, follow_up_instructions: e.target.value })}
                          className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">OPD Follow-up Date</label>
                        <input
                          type="date"
                          value={dischargeForm.follow_up_date}
                          onChange={(e) => setDischargeForm({ ...dischargeForm, follow_up_date: e.target.value })}
                          className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={dischargeMutation.isPending}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 flex items-center gap-2"
                      >
                        <FileCheck className="w-4 h-4" />
                        {dischargeMutation.isPending ? "Discharging..." : "Complete Discharge & Free Bed"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
