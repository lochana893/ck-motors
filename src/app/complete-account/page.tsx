"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import { createClient } from "@/lib/supabase/client";

export default function CompleteAccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function verifyAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status, must_change_password")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "customer" || profile.status === "disabled") {
        router.replace(profile?.role === "admin" || profile?.role === "staff" ? "/admin" : "/dashboard");
        return;
      }

      if (!profile.must_change_password) {
        router.replace("/dashboard");
        return;
      }

      setLoading(false);
    }

    void verifyAccount();
  }, [router, supabase]);

  function validatePassword(password: string) {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validatePassword(newPassword)) {
      setError("Use at least 8 characters, including uppercase, lowercase, and a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      setSaving(false);
      setError(passwordError.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Your session has expired. Please log in again.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id)
      .eq("role", "customer");

    setSaving(false);
    if (profileError) {
      console.error("Unable to complete customer account setup:", profileError);
      setError(`Password updated, but account setup could not be completed: ${profileError.message}`);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] text-slate-900">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <AuthHeader />
      <section className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-7 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600">Account Setup</p>
            <h1 className="mt-2 text-3xl font-black">Welcome to CK Motors</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              For security, please create your new password before continuing.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="new-password"
              label="New Password *"
              value={newPassword}
              visible={showPassword}
              onChange={setNewPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirm New Password *"
              value={confirmPassword}
              visible={showConfirmPassword}
              onChange={setConfirmPassword}
              onToggle={() => setShowConfirmPassword((current) => !current)}
              autoComplete="new-password"
            />
            <p className="text-xs leading-5 text-slate-500">
              Minimum 8 characters with uppercase, lowercase, and a number.
            </p>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</p>}
            <button disabled={saving} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? "Updating Password..." : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none focus:border-red-600"
        />
        <button type="button" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
