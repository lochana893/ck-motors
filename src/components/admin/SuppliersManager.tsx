"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const emptySupplier = {
  name: "",
  contact_person: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

export default function SuppliersManager() {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptySupplier);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSuppliers = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("suppliers")
      .select(`
        id,
        name,
        contact_person,
        phone,
        whatsapp,
        email,
        address,
        notes,
        is_active,
        created_at,
        updated_at
      `)
      .order("name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSuppliers]);

  function startAdd() {
    setEditing(null);
    setForm(emptySupplier);
    setShowForm(true);
  }

  function startEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      whatsapp: supplier.whatsapp || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      is_active: supplier.is_active,
    });
    setShowForm(true);
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    if (!payload.name) {
      setError("Supplier name is required.");
      setSaving(false);
      return;
    }

    if (editing) {
      const { error: updateError } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editing.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setMessage("Supplier updated.");
    } else {
      const { error: insertError } = await supabase.from("suppliers").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      setMessage("Supplier added.");
    }

    setShowForm(false);
    setForm(emptySupplier);
    setEditing(null);
    setSaving(false);
    await loadSuppliers();
  }

  async function toggleActive(supplier: Supplier) {
    const { error: toggleError } = await supabase
      .from("suppliers")
      .update({ is_active: !supplier.is_active })
      .eq("id", supplier.id);

    if (toggleError) {
      setError(toggleError.message);
      return;
    }

    setMessage(`${supplier.name} ${!supplier.is_active ? "activated" : "deactivated"}.`);
    await loadSuppliers();
  }

  async function deleteSupplier(supplier: Supplier) {
    const confirmed = window.confirm(`Deactivate ${supplier.name} instead of deleting it?`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", supplier.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Supplier deactivated.");
    await loadSuppliers();
  }

  const visibleSuppliers = suppliers.filter((supplier) =>
    `${supplier.name} ${supplier.contact_person || ""} ${supplier.phone || ""} ${supplier.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Suppliers</h2>
          <p className="mt-1 text-xs text-gray-500">Manage suppliers for inventory and workshop purchases.</p>
        </div>
        <button type="button" onClick={startAdd} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white">
          <Plus size={14} className="mr-1 inline" /> Add Supplier
        </button>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#080808] px-3">
        <Search size={15} className="text-gray-600" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers..." className="w-full bg-transparent px-1 py-3 text-sm outline-none" />
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mb-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-400">{message}</p>}

      <div className="grid gap-3">
        {visibleSuppliers.map((supplier) => (
          <div key={supplier.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950/40 text-red-400">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="font-bold">{supplier.name}</p>
                  <p className="text-xs text-gray-500">{supplier.contact_person || "No contact person"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => startEdit(supplier)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                  <Pencil size={12} className="mr-1 inline" /> Edit
                </button>
                <button type="button" onClick={() => toggleActive(supplier)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                  {supplier.is_active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" onClick={() => deleteSupplier(supplier)} className="rounded-lg border border-red-900/40 px-3 py-2 text-xs font-bold text-red-500">
                  <Trash2 size={12} className="mr-1 inline" /> Safe Delete
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-gray-400 sm:grid-cols-2 lg:grid-cols-3">
              {supplier.phone && <span>Phone: {supplier.phone}</span>}
              {supplier.whatsapp && <span>WhatsApp: {supplier.whatsapp}</span>}
              {supplier.email && <span>Email: {supplier.email}</span>}
              {supplier.address && <span className="sm:col-span-2 lg:col-span-3">Address: {supplier.address}</span>}
            </div>
          </div>
        ))}

        {visibleSuppliers.length === 0 && <p className="py-10 text-center text-xs text-gray-500">No suppliers found.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black">{editing ? "Edit Supplier" : "Add Supplier"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 p-2 text-gray-400"><X size={18} /></button>
            </div>

            <form onSubmit={saveSupplier} className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Supplier Name
                <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Contact Person
                <input value={form.contact_person} onChange={(event) => setForm((current) => ({ ...current, contact_person: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Phone
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                WhatsApp
                <input value={form.whatsapp} onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Email
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Address
                <textarea rows={3} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
                Active
              </label>

              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-4 py-3 text-xs font-bold text-gray-400">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-60">
                  {saving ? "Saving..." : editing ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
