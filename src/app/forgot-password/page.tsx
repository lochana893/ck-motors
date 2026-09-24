"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthHeader from "@/components/AuthHeader";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      "Password reset link sent. Please check your email inbox."
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <AuthHeader />
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <h1 className="mt-2 text-3xl font-black">
            Forgot Password?
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Enter your email and we&apos;ll send you a password reset link.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-600"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-900/60 bg-green-950/20 p-3 text-xs leading-5 text-green-400">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full cursor-pointer rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <a
              href="/login"
              className="text-xs font-bold text-red-500 hover:text-red-400"
            >
              ← Back to Login
            </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}