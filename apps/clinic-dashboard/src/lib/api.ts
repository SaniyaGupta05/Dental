const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

class ApiClient {
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("nidaan_staff_token");
  }

  public setAuthToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("nidaan_staff_token", token);
    }
  }

  public clearAuthToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("nidaan_staff_token");
      localStorage.removeItem("nidaan_staff_user");
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorData: any = {};
      try {
        errorData = await res.json();
      } catch {
        errorData = { error: { code: `HTTP_${res.status}`, message: res.statusText } };
      }
      const message = errorData?.error?.message || errorData?.detail || "An error occurred";
      throw new Error(message);
    }

    return res.json();
  }

  // Auth
  async staffLogin(email: string, password: string) {
    const data = await this.request<any>("/auth/staff/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setAuthToken(data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("nidaan_staff_user", JSON.stringify(data));
    }
    return data;
  }

  async getMe() {
    return this.request<any>("/auth/me");
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } finally {
      this.clearAuthToken();
    }
  }

  // Dashboard & Admin
  async getDashboardKpis() {
    return this.request<any>("/admin/dashboard");
  }

  async getAdminAppointments(params?: { date?: string; doctor_id?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.append("date", params.date);
    if (params?.doctor_id) query.append("doctor_id", params.doctor_id);
    if (params?.status) query.append("status", params.status);
    return this.request<any[]>(`/admin/appointments?${query.toString()}`);
  }

  async getPatients(queryTerm?: string, page = 1, size = 20) {
    const query = new URLSearchParams({ page: String(page), size: String(size) });
    if (queryTerm) query.append("query", queryTerm);
    return this.request<any>(`/admin/patients?${query.toString()}`);
  }

  async getPatientDetail(patientId: string) {
    return this.request<any>(`/admin/patients/${patientId}`);
  }

  async createPatientAtDesk(data: any) {
    return this.request<any>("/admin/patients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePatient(patientId: string, data: any) {
    return this.request<any>(`/admin/patients/${patientId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deletePatient(patientId: string) {
    return this.request<any>(`/admin/patients/${patientId}`, {
      method: "DELETE",
    });
  }

  async getAuditLogs(limit = 50) {
    return this.request<any[]>(`/admin/audit-logs?limit=${limit}`);
  }

  async getSettings() {
    return this.request<any>("/admin/settings");
  }

  async updateSettings(data: any) {
    return this.request<any>("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Appointments
  async updateAppointmentStatus(appointmentId: string, status: string, notes?: string, extra?: any) {
    return this.request<any>(`/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes, ...extra }),
    });
  }

  async createAppointmentDirect(data: any) {
    return this.request<any>("/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Clinical Records & Prescriptions
  async createTreatmentRecord(appointmentId: string, data: any) {
    return this.request<any>(`/clinical/appointments/${appointmentId}/treatment-records`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTreatmentRecord(appointmentId: string) {
    return this.request<any>(`/clinical/appointments/${appointmentId}/treatment-records`);
  }

  async createPrescription(data: any) {
    return this.request<any>("/clinical/prescriptions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPatientPrescriptions(patientId: string) {
    return this.request<any[]>(`/clinical/patients/${patientId}/prescriptions`);
  }

  // Documents
  async uploadDocument(patientId: string, formData: FormData) {
    return this.request<any>(`/documents/patients/${patientId}/documents`, {
      method: "POST",
      body: formData,
    });
  }

  async getPatientDocuments(patientId: string) {
    return this.request<any[]>(`/documents/patients/${patientId}/documents`);
  }

  async getDocumentDownloadUrl(documentId: string) {
    return this.request<any>(`/documents/${documentId}/download-url`);
  }

  async deleteDocument(documentId: string) {
    return this.request<any>(`/documents/${documentId}`, {
      method: "DELETE",
    });
  }

  // Notifications & Follow-ups
  async getNotifications() {
    return this.request<any[]>("/notifications");
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: "PATCH" });
  }

  async listFollowUps(status?: string) {
    const q = status ? `?status=${status}` : "";
    return this.request<any[]>(`/notifications/admin/follow-ups${q}`);
  }

  async updateFollowUpStatus(followUpId: string, status: string) {
    return this.request<any>(`/notifications/admin/follow-ups/${followUpId}/status?target_status=${status}`, {
      method: "PATCH",
    });
  }

  // Services & Doctors
  async getServices() {
    return this.request<any[]>("/services");
  }

  async getDoctors() {
    return this.request<any[]>("/services/doctors");
  }

  async getAvailability(doctorId: string, dateStr: string) {
    return this.request<any>(`/availability?doctor_id=${doctorId}&date=${dateStr}`);
  }

  // IPD Admissions & Ward / Bed Management
  async getWards() {
    return this.request<any[]>("/admissions/wards");
  }

  async updateBedStatus(bedId: string, status: string, notes?: string) {
    return this.request<any>(`/admissions/beds/${bedId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    });
  }

  async getAdmissions(params?: { status?: string; patient_id?: string; doctor_id?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.patient_id) query.append("patient_id", params.patient_id);
    if (params?.doctor_id) query.append("doctor_id", params.doctor_id);
    const qs = query.toString();
    return this.request<any[]>(`/admissions${qs ? `?${qs}` : ""}`);
  }

  async getAdmissionDetail(admissionId: string) {
    return this.request<any>(`/admissions/${admissionId}`);
  }

  async createAdmission(data: any) {
    return this.request<any>("/admissions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async transferAdmissionBed(admissionId: string, new_bed_id: string, reason?: string) {
    return this.request<any>(`/admissions/${admissionId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ new_bed_id, reason }),
    });
  }

  async addInpatientNote(admissionId: string, data: any) {
    return this.request<any>(`/admissions/${admissionId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async dischargeAdmission(admissionId: string, data: any) {
    return this.request<any>(`/admissions/${admissionId}/discharge`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Billing & Receipts (OPD + IPD)
  async getInvoices(params?: { billing_type?: string; status?: string; patient_id?: string; admission_id?: string }) {
    const query = new URLSearchParams();
    if (params?.billing_type) query.append("billing_type", params.billing_type);
    if (params?.status) query.append("status", params.status);
    if (params?.patient_id) query.append("patient_id", params.patient_id);
    if (params?.admission_id) query.append("admission_id", params.admission_id);
    const qs = query.toString();
    return this.request<any[]>(`/billing/invoices${qs ? `?${qs}` : ""}`);
  }

  async getInvoiceDetail(invoiceId: string) {
    return this.request<any>(`/billing/invoices/${invoiceId}`);
  }

  async createInvoice(data: any) {
    return this.request<any>("/billing/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async recordInvoicePayment(invoiceId: string, amount: number, payment_method: string, notes?: string) {
    return this.request<any>(`/billing/invoices/${invoiceId}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount, payment_method, notes }),
    });
  }
}

export const api = new ApiClient();
