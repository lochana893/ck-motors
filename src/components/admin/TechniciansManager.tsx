"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, UserCog, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Technician = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  status: "available" | "busy" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const emptyTechnician = {
  full_name: "",
  phone: "",
  email: "",
  specialization: "General Mechanic",
  status: "available" as Technician["status"],
  notes: "",
};

export default function TechniciansManager() {
  const supabase = useMemo(() => createClient(), []);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);
  const [form, setForm] = useState(emptyTechnician);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ active: 0, inactive: 0, busy: 0, assignedToday: 0 });

  const loadTechnicians = useCallback(async () => {
    const [{ data: technicianData, error: technicianError }, { data: serviceRecords, error: serviceRecordError }] = await Promise.all([
      supabase.from("technicians").select("*").order("full_name", { ascending: true }),
      supabase
        .from("service_records")
        .select("service_date, technician_name")
        .gte("service_date", new Date().toISOString().slice(0, 10))
        .lt("service_date", new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
    ]);

    if (technicianError) {
      setError(technicianError.message);
      return;
    }

    const items = (technicianData || []) as Technician[];
    const today = new Date().toISOString().slice(0, 10);
    const assignedToday = (serviceRecords || []).filter((record) => record.service_date && record.service_date.startsWith(today) && Boolean(record.technician_name)).length;

    setTechnicians(items);
    setStats({
      active: items.filter((item) => item.status === "available").length,
      inactive: items.filter((item) => item.status === "inactive").length,
      busy: items.filter((item) => item.status === "busy").length,
      assignedToday,
    });

    if (serviceRecordError) {
      setError(serviceRecordError.message);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTechnicians();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTechnicians]);

  function startAdd() {
    setEditing(null);
    setForm(emptyTechnician);
    setShowForm(true);
  }

  function startEdit(technician: Technician) {
    setEditing(technician);
    setForm({
      full_name: technician.full_name,
      phone: technician.phone || "",
      email: technician.email || "",
      specialization: technician.specialization || "General Mechanic",
      status: technician.status,
      notes: technician.notes || "",
    });
    setShowForm(true);
  }

  async function saveTechnician(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      specialization: form.specialization.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    if (!payload.full_name) {
      setError("Technician name is required.");
      setSaving(false);
      return;
    }

    if (editing) {
      const { error: updateError } = await supabase
        .from("technicians")
        .update(payload)
        .eq("id", editing.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setMessage("Technician updated.");
    } else {
      const { error: insertError } = await supabase.from("technicians").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      setMessage("Technician added.");
    }

    setShowForm(false);
    setForm(emptyTechnician);
    setEditing(null);
    setSaving(false);
    await loadTechnicians();
  }

  async function toggleStatus(technician: Technician) {
    const nextStatus = technician.status === "inactive" ? "available" : "inactive";
    const { error: updateError } = await supabase
      .from("technicians")
      .update({ status: nextStatus })
      .eq("id", technician.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(`${technician.full_name} marked ${nextStatus}.`);
    await loadTechnicians();
  }

  const visibleTechnicians = technicians.filter((technician) =>
    `${technician.full_name} ${technician.phone || ""} ${technician.email || ""} ${technician.specialization || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Technicians</h2>
          <p className="mt-1 text-xs text-gray-500">Track technician availability, assignments, and specializations.</p>
        </div>
        <button type="button" onClick={startAdd} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white">
          <Plus size={14} className="mr-1 inline" /> Add Technician
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Available</p><p className="mt-2 text-2xl font-black">{stats.active}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Assigned Today</p><p className="mt-2 text-2xl font-black">{stats.assignedToday}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Busy</p><p className="mt-2 text-2xl font-black">{stats.busy}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Inactive</p><p className="mt-2 text-2xl font-black">{stats.inactive}</p></div>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#080808] px-3">
        <Search size={15} className="text-gray-600" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search technicians..." className="w-full bg-transparent px-1 py-3 text-sm outline-none" />
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mb-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-400">{message}</p>}

      <div className="grid gap-3">
        {visibleTechnicians.map((technician) => (
          <div key={technician.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950/40 text-red-400">
                  <UserCog size={18} />
                </div>
                <div>
                  <p className="font-bold">{technician.full_name}</p>
                  <p className="text-xs text-gray-500">{technician.specialization || "General Mechanic"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${technician.status === "available" ? "bg-emerald-950/40 text-emerald-400" : technician.status === "busy" ? "bg-amber-950/40 text-amber-400" : "bg-gray-800 text-gray-500"}`}>
                  {technician.status}
                </span>
                <button type="button" onClick={() => startEdit(technician)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                  <Pencil size={12} className="mr-1 inline" /> Edit
                </button>
                <button type="button" onClick={() => toggleStatus(technician)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                  {technician.status === "inactive" ? "Activate" : "Deactivate"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-gray-400 sm:grid-cols-2 lg:grid-cols-3">
              {technician.phone && <span>Phone: {technician.phone}</span>}
              {technician.email && <span>Email: {technician.email}</span>}
              {technician.notes && <span className="sm:col-span-2 lg:col-span-3">Notes: {technician.notes}</span>}
            </div>
          </div>
        ))}

        {visibleTechnicians.length === 0 && <p className="py-10 text-center text-xs text-gray-500">No technicians found.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black">{editing ? "Edit Technician" : "Add Technician"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 p-2 text-gray-400"><X size={18} /></button>
            </div>

            <form onSubmit={saveTechnician} className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Full Name
                <input required value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Phone
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Email
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Specialization
                <input value={form.specialization} onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Status
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Technician["status"] }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white">
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>

              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-4 py-3 text-xs font-bold text-gray-400">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-60">
                  {saving ? "Saving..." : editing ? "Update Technician" : "Save Technician"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
