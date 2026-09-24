"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Plus, Search, Trash2, X } from "lucide-react";
import { isProtectedOwnerEmail } from "@/lib/protected-owner";

type AdminUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "admin" | "staff" | "customer";
  status: "active" | "disabled";
  must_change_password: boolean;
  created_at: string;
};

const emptyForm = { full_name: "", email: "", phone: "", role: "customer" as AdminUser["role"] };

export default function AdminUsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [temporary, setTemporary] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    const result = (await response.json()) as { users?: AdminUser[]; error?: string };
    if (!response.ok) { setError(result.error || "Users could not be loaded."); return; }
    setUsers(result.users || []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = (await response.json()) as { user?: AdminUser; temporaryPassword?: string; error?: string };
    setSaving(false);
    if (!response.ok || !result.user || !result.temporaryPassword) { setError(result.error || "User could not be created."); return; }
    setTemporary({ name: result.user.full_name, email: result.user.email, password: result.temporaryPassword });
    setShowAdd(false); setForm(emptyForm); await loadUsers();
  }

  async function updateUser(user: AdminUser, values: Partial<AdminUser>) {
    setError(""); setMessage("");
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, ...values }) });
    const result = (await response.json()) as { user?: AdminUser; error?: string };
    if (!response.ok || !result.user) { setError(result.error || "User could not be updated."); return; }
    setUsers((current) => current.map((item) => item.id === user.id ? result.user! : item));
    setEditing(null); setMessage("User updated.");
  }

  async function resetPassword(user: AdminUser) {
    if (!window.confirm(`Reset ${user.full_name}'s password? The current password will stop working.`)) return;
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, action: "reset" }) });
    const result = (await response.json()) as { user?: AdminUser; temporaryPassword?: string; error?: string };
    if (!response.ok || !result.user || !result.temporaryPassword) { setError(result.error || "Password could not be reset."); return; }
    setTemporary({ name: user.full_name, email: user.email, password: result.temporaryPassword }); await loadUsers();
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.full_name}? Accounts with history must be deactivated instead.`)) return;
    const response = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) { setError(result.error || "User could not be deleted."); return; }
    setUsers((current) => current.filter((item) => item.id !== user.id)); setMessage("User deleted.");
  }

  const visibleUsers = users.filter((user) => `${user.full_name} ${user.email} ${user.phone || ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black">Admin Users</h2><p className="mt-1 text-xs text-gray-500">Manage administrators, staff, and customer accounts.</p></div>
        <button type="button" onClick={() => setShowAdd(true)} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500"><Plus size={14} className="mr-1 inline" /> Add user</button>
      </div>
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#080808] px-3"><Search size={15} className="text-gray-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="w-full bg-transparent px-1 py-3 text-sm outline-none" /></div>
      {error && <p className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mb-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-400">{message}</p>}
      <div className="grid gap-3">
        {visibleUsers.map((user) => <div key={user.id} className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="font-bold">{user.full_name}</p><p className="text-xs text-gray-500">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className="rounded-full bg-red-950/40 px-2 py-1 text-red-400">{user.role}</span><span className={`rounded-full px-2 py-1 ${user.status === "active" ? "bg-emerald-950/40 text-emerald-400" : "bg-gray-800 text-gray-500"}`}>{user.status}</span>{isProtectedOwnerEmail(user.email) && <span title="Primary owner account is protected." className="rounded-full bg-amber-950/40 px-2 py-1 text-amber-400">Primary Owner</span>}{user.must_change_password && <span className="rounded-full bg-amber-950/40 px-2 py-1 text-amber-400">temporary password</span>}</div></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(user)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400 hover:border-red-500 hover:text-red-400">{isProtectedOwnerEmail(user.email) ? "Edit Profile" : "Edit"}</button>
            <button type="button" onClick={() => resetPassword(user)} className="inline-flex items-center gap-1 rounded-lg border border-amber-900/40 px-3 py-2 text-xs font-bold text-amber-500"><KeyRound size={13} /> Reset</button>
            {!isProtectedOwnerEmail(user.email) && <><button type="button" onClick={() => void updateUser(user, { status: user.status === "active" ? "disabled" : "active" })} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">{user.status === "active" ? "Deactivate" : "Activate"}</button><button type="button" onClick={() => void deleteUser(user)} className="rounded-lg border border-red-900/40 px-3 py-2 text-xs font-bold text-red-500"><Trash2 size={13} className="mr-1 inline" /> Delete</button></>}
          </div>
        </div>)}
        {visibleUsers.length === 0 && <p className="py-8 text-center text-xs text-gray-500">No users found.</p>}
      </div>
      {(showAdd || editing) && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6">
        <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-black">{showAdd ? "Add user" : `Edit ${editing?.full_name}`}</h3><button type="button" onClick={() => { setShowAdd(false); setEditing(null); }}><X size={18} /></button></div>
        {showAdd ? <form onSubmit={createUser} className="space-y-4"><UserFields form={form} setForm={setForm} includeEmail /><button disabled={saving} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Creating..." : "Create user"}</button></form> : editing && <EditUserForm user={editing} saving={saving} onSave={(values) => { setSaving(true); void updateUser(editing, values).finally(() => setSaving(false)); }} />}
      </div></div>}
      {temporary && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-amber-700/40 bg-[#17120a] p-6"><h3 className="text-lg font-black text-amber-400">One-time temporary password</h3><p className="mt-2 text-xs text-amber-100/70">Share this securely with {temporary.name}. It will not be shown again.</p><div className="mt-4 space-y-2 rounded-lg bg-black/30 p-4 text-sm"><p>{temporary.email}</p><p className="font-mono text-lg text-amber-300">{temporary.password}</p></div><button type="button" onClick={() => { void navigator.clipboard.writeText(temporary.password); setCopied(true); }} className="mt-4 w-full rounded-lg border border-amber-500/40 px-4 py-3 text-sm font-bold text-amber-300">{copied ? "Password copied" : "Copy password"}</button><button type="button" onClick={() => { setTemporary(null); setCopied(false); }} className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-black">I saved the password</button></div></div>}
    </section>
  );
}

function UserFields({ form, setForm, includeEmail }: { form: typeof emptyForm; setForm: (form: typeof emptyForm) => void; includeEmail?: boolean }) {
  return <><label className="block text-xs font-bold text-gray-400">Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none" /></label>{includeEmail && <label className="block text-xs font-bold text-gray-400">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none" /></label>}<label className="block text-xs font-bold text-gray-400">Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none" /></label><label className="block text-xs font-bold text-gray-400">Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminUser["role"] })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none"><option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option></select></label></>;
}

function EditUserForm({ user, saving, onSave }: { user: AdminUser; saving: boolean; onSave: (values: Partial<AdminUser>) => void }) {
  const [name, setName] = useState(user.full_name); const [phone, setPhone] = useState(user.phone || ""); const [role, setRole] = useState(user.role);
  const protectedOwner = isProtectedOwnerEmail(user.email);
  return <form onSubmit={(event) => { event.preventDefault(); onSave({ full_name: name, phone, ...(protectedOwner ? {} : { role }) }); }} className="space-y-4"><label className="block text-xs font-bold text-gray-400">Full name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none" /></label><label className="block text-xs font-bold text-gray-400">Email<input disabled value={user.email} className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500" /></label><label className="block text-xs font-bold text-gray-400">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none" /></label>{protectedOwner ? <p title="Primary owner account is protected." className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">Primary owner role and status are protected.</p> : <label className="block text-xs font-bold text-gray-400">Role<select value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none"><option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option></select></label>}<button disabled={saving} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button></form>;
}
