"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =useState("");
   const [showPassword, setShowPassword] = useState(false);
   const [showConfirmPassword, setShowConfirmPassword] = useState(false); 

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function prepareRecoverySession() {
      setChecking(true);
      setError("");

      // Already authenticated/recovery session exists
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setReady(true);
        setChecking(false);
        return;
      }

      // PKCE recovery link
      const params = new URLSearchParams(
        window.location.search
      );

      const code = params.get("code");

      if (!code) {
        setReady(false);
        setChecking(false);
        setError(
          "Invalid password reset link. Please request a new reset link."
        );
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error(exchangeError);

        setReady(false);
        setChecking(false);

        setError(
          "Reset link is invalid, expired, or has already been used. Please request a new link."
        );

        return;
      }

      // Remove one-time code from browser URL
      window.history.replaceState(
        {},
        "",
        "/reset-password"
      );

      setReady(true);
      setChecking(false);
    }

    void prepareRecoverySession();
  }, [supabase]);

  async function handleReset(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!ready) {
      setError(
        "Please request a new password reset link."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      console.error("Password reset failed:", updateError);
      setError(
        updateError.message.toLowerCase().includes("different")
          ? "Choose a new password that is different from your current password."
          : "Unable to update your password. Please request a new reset link and try again.",
      );
      setLoading(false);
      return;
    }

    setSuccess(
      "Password updated successfully. Redirecting to login..."
    );

    setPassword("");
    setConfirmPassword("");

    setTimeout(async () => {
      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    }, 1500);

    setLoading(false);
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] text-slate-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />

          <p className="text-sm text-gray-500">
            Verifying password reset link...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <AuthHeader />
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <h1 className="mt-2 text-3xl font-black">
            Create New Password
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Enter your new CK Motors account password.
          </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs leading-5 text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-900/60 bg-green-950/20 p-3 text-xs text-green-400">
              {success}
            </div>
          )}

          {ready && (
            <form
              onSubmit={handleReset}
              className="space-y-4"
            >
            <div>
  <label className="mb-2 block text-xs font-semibold text-gray-400">
    New Password
  </label>

  <div className="relative">
    <input
      type={showPassword ? "text" : "password"}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="Minimum 6 characters"
      autoComplete="new-password"
      className="auth-input w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 pr-12 text-sm outline-none focus:border-red-600"
    />

    <button
      type="button"
      onClick={() => setShowPassword((current) => !current)}
      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition hover:text-red-500"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
</div>

             <div>
  <label className="mb-2 block text-xs font-semibold text-gray-400">
    Confirm New Password
  </label>

  <div className="relative">
    <input
      type={showConfirmPassword ? "text" : "password"}
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      placeholder="Enter password again"
      autoComplete="new-password"
      className="auth-input w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 pr-12 text-sm outline-none focus:border-red-600"
    />

    <button
      type="button"
      onClick={() =>
        setShowConfirmPassword((current) => !current)
      }
      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition hover:text-red-500"
    >
      {showConfirmPassword ? (
        <EyeOff size={18} />
      ) : (
        <Eye size={18} />
      )}
    </button>
  </div>
</div>

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-lg bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500 disabled:opacity-50"
              >
                {loading
                  ? "Updating..."
                  : "Update Password"}
              </button>
            </form>
          )}

          {!ready && (
            <button
              onClick={() =>
                router.push("/forgot-password")
              }
              className="w-full cursor-pointer rounded-lg bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500"
            >
              Request New Reset Link
            </button>
          )}
        </div>
      </div>
    </main>
  );
}