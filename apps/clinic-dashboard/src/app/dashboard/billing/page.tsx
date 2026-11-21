"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Receipt, Plus, Printer, IndianRupee, X, CheckCircle2 } from "lucide-react";

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");

  const [form, setForm] = useState({
    patient_id: "",
    billing_type: "OPD",
    admission_id: "",
    discount_amount: "0",
    paid_amount: "0",
    payment_method: "UPI",
    notes: "",
    items: [
      { description: "OPD Pediatric Consultation", category: "CONSULTATION", quantity: 1, unit_price: 500 },
    ],
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", filterType],
    queryFn: () => api.getInvoices(filterType ? { billing_type: filterType } : undefined),
  });

  const { data: patientsData } = useQuery({
    queryKey: ["patientsForBilling"],
    queryFn: () => api.getPatients("", 1, 100),
  });

  const { data: admissions = [] } = useQuery({
    queryKey: ["admissionsForBilling"],
    queryFn: () => api.getAdmissions(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardKpis"] });
      setShowCreateModal(false);
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method }: { id: string; amount: number; method: string }) =>
      api.recordInvoicePayment(id, amount, method),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardKpis"] });
      setSelectedInvoice(updated);
      setPayAmount("");
    },
  });

  const addItemRow = () => {
    setForm({
      ...form,
      items: [...form.items, { description: "", category: "OTHER", quantity: 1, unit_price: 0 }],
    });
  };

  const updateItemRow = (idx: number, field: string, value: any) => {
    const next = [...form.items];
    next[idx] = { ...next[idx], [field]: value };
    setForm({ ...form, items: next });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      patient_id: form.patient_id,
      billing_type: form.billing_type,
      admission_id: form.billing_type === "IPD" && form.admission_id ? form.admission_id : null,
      discount_amount: parseFloat(form.discount_amount || "0"),
      paid_amount: parseFloat(form.paid_amount || "0"),
      payment_method: form.payment_method,
      notes: form.notes || null,
      items: form.items.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PARTIALLY_PAID":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            OPD & IPD Billing & Receipts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Nidaan Children Hospital • Generate OPD receipts, IPD ward bills & printable invoices
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 text-xs font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-md shadow-teal-600/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Bill / Receipt
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2">
        {[
          { label: "All Bills", val: "" },
          { label: "OPD Receipts", val: "OPD" },
          { label: "IPD Bills", val: "IPD" },
        ].map((t) => (
          <button
            key={t.val}
            onClick={() => setFilterType(t.val)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filterType === t.val
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No invoices generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Invoice No.</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {inv.billing_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{inv.patient_name}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{inv.total_amount}</td>
                    <td className="py-3 px-4 text-slate-600">₹{inv.paid_amount}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-semibold"
                      >
                        View / Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Create OPD Receipt / IPD Bill</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Patient *</label>
                  <select
                    required
                    value={form.patient_id}
                    onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="">Select patient...</option>
                    {(patientsData?.items || []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Type *</label>
                  <select
                    value={form.billing_type}
                    onChange={(e) => setForm({ ...form, billing_type: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="OPD">OPD Receipt</option>
                    <option value="IPD">IPD Admission Bill</option>
                  </select>
                </div>
              </div>

              {form.billing_type === "IPD" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Link to IPD Admission</label>
                  <select
                    value={form.admission_id}
                    onChange={(e) => setForm({ ...form, admission_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="">Optional: select admission...</option>
                    {admissions.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.admission_number} — {a.patient_name} ({a.ward_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Line Items</label>
                  <button type="button" onClick={addItemRow} className="text-teal-600 font-semibold">
                    + Add Item
                  </button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItemRow(idx, "description", e.target.value)}
                      className="col-span-5 p-2 border border-slate-200 rounded-lg bg-slate-50"
                    />
                    <select
                      value={item.category}
                      onChange={(e) => updateItemRow(idx, "category", e.target.value)}
                      className="col-span-3 p-2 border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <option value="CONSULTATION">Consultation</option>
                      <option value="BED_CHARGE">Bed Charge</option>
                      <option value="VACCINATION">Vaccination</option>
                      <option value="PROCEDURE">Procedure</option>
                      <option value="PHARMACY">Pharmacy</option>
                      <option value="LAB">Lab</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItemRow(idx, "quantity", e.target.value)}
                      className="col-span-2 p-2 border border-slate-200 rounded-lg bg-slate-50"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unit_price}
                      onChange={(e) => updateItemRow(idx, "unit_price", e.target.value)}
                      className="col-span-2 p-2 border border-slate-200 rounded-lg bg-slate-50"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.discount_amount}
                    onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paid Now (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.paid_amount}
                    onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MEDICLAIM">Mediclaim</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700"
                >
                  {createMutation.isPending ? "Saving..." : "Generate Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail & Printable Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-teal-700">{selectedInvoice.invoice_number}</span>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border border-slate-200 rounded-xl space-y-4 text-xs">
              <div className="text-center border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900">NIDAAN CHILDREN HOSPITAL</h3>
                <p className="text-[11px] text-slate-500">
                  303-305 & 4th Floor, Veer Enclave, Near Tulsidham Char Rasta, Manjalpur, Vadodara - 390011
                </p>
                <p className="text-[11px] text-slate-500">Phone: +91 94263 22819 / 0265-2644217</p>
                <p className="text-xs font-bold text-teal-700 mt-1">
                  {selectedInvoice.billing_type === "IPD" ? "IPD HOSPITAL BILL" : "OPD RECEIPT"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <p><strong>Invoice No:</strong> {selectedInvoice.invoice_number}</p>
                <p><strong>Date:</strong> {new Date(selectedInvoice.issued_at).toLocaleDateString()}</p>
                <p><strong>Patient:</strong> {selectedInvoice.patient_name}</p>
                <p><strong>Status:</strong> {selectedInvoice.status}</p>
              </div>

              <table className="w-full border-t border-b border-slate-200">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 border-b border-slate-100">
                    <th className="py-2">Description</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedInvoice.items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-2 font-medium">{it.description}</td>
                      <td className="py-2">{it.quantity}</td>
                      <td className="py-2">₹{it.unit_price}</td>
                      <td className="py-2 text-right font-semibold">₹{it.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-right">
                <p>Subtotal: <strong>₹{selectedInvoice.subtotal}</strong></p>
                {selectedInvoice.discount_amount > 0 && (
                  <p>Discount: <strong>-₹{selectedInvoice.discount_amount}</strong></p>
                )}
                <p className="text-sm font-bold text-slate-900">Total: ₹{selectedInvoice.total_amount}</p>
                <p className="text-emerald-700 font-semibold">Paid: ₹{selectedInvoice.paid_amount}</p>
                <p className="text-rose-600 font-semibold">Balance Due: ₹{selectedInvoice.balance_amount}</p>
              </div>
            </div>

            {selectedInvoice.balance_amount > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl flex flex-wrap items-center gap-2 print:hidden text-xs">
                <input
                  type="number"
                  placeholder={`Pay up to ₹${selectedInvoice.balance_amount}`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg bg-white flex-1"
                />
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="MEDICLAIM">Mediclaim</option>
                </select>
                <button
                  disabled={!payAmount || payMutation.isPending}
                  onClick={() =>
                    payMutation.mutate({
                      id: selectedInvoice.id,
                      amount: parseFloat(payAmount),
                      method: payMethod,
                    })
                  }
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold"
                >
                  Record Payment
                </button>
              </div>
            )}

            <div className="flex justify-end print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold flex items-center gap-2 text-xs"
              >
                <Printer className="w-4 h-4" />
                Print Receipt / Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
