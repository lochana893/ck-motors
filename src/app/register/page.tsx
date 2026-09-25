"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import SehasCredit from "@/components/SehasCredit";
export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        setSuccess("Account created successfully. Redirecting...");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1000);
      } else {
        setSuccess(
          "Account created successfully. Please check your email and confirm your account before logging in."
        );

        setFullName("");
        setPhone("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <AuthHeader />

      {/* Register */}
      <section className="relative flex min-h-[calc(100vh-65px)] items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-700/10 blur-[120px]" />

        <div className="relative w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="mb-3 inline-flex rounded-full border border-red-200 bg-red-50 px-4 py-1 text-[10px] font-bold tracking-[0.18em] text-red-600">
              CUSTOMER REGISTRATION
            </div>

            <h1 className="text-3xl font-black">
              Create Your{" "}
              <span className="text-red-500">CK Motors</span> Account
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Register to manage your vehicles, book services and view your
              complete service history.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Full Name
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="auth-input w-full rounded-lg border border-white/10 bg-[#090909] px-4 py-3 text-sm outline-none transition focus:border-red-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Phone Number
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07X XXX XXXX"
                  autoComplete="tel"
                  className="auth-input w-full rounded-lg border border-white/10 bg-[#090909] px-4 py-3 text-sm outline-none transition focus:border-red-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="auth-input w-full rounded-lg border border-white/10 bg-[#090909] px-4 py-3 text-sm outline-none transition focus:border-red-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Password
                </label>

                <div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="Minimum 6 characters"
    autoComplete="new-password"
    className="auth-input w-full rounded-lg border border-white/10 bg-[#090909] px-4 py-3 pr-12 text-sm outline-none focus:border-red-600"
  />

  <button
    type="button"
    onClick={() => setShowPassword((current) => !current)}
    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 transition hover:text-red-500"
  >
    {showPassword ? (
      <EyeOff size={18} />
    ) : (
      <Eye size={18} />
    )}
  </button>
</div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Confirm Password
                </label>

                <div className="relative">
  <input
    type={showConfirmPassword ? "text" : "password"}
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    placeholder="Enter password again"
    autoComplete="new-password"
    className="auth-input w-full rounded-lg border border-white/10 bg-[#090909] px-4 py-3 pr-12 text-sm outline-none focus:border-red-600"
  />

  <button
    type="button"
    onClick={() =>
      setShowConfirmPassword((current) => !current)
    }
    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 transition hover:text-red-500"
  >
    {showConfirmPassword ? (
      <EyeOff size={18} />
    ) : (
      <Eye size={18} />
    )}
  </button>
</div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-xs leading-5 text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-green-900/70 bg-green-950/30 px-4 py-3 text-xs leading-5 text-green-400">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-4 py-3 text-sm font-bold text-white transition hover:from-red-500 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div className="my-5 h-px bg-white/10" />

            <p className="text-center text-xs text-gray-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-red-500 hover:text-red-400"
              >
                Login
              </Link>
            </p>
          </div>

          <p className="mt-5 text-center text-[11px] text-gray-700">
            © {new Date().getFullYear()} CK Motors. All Rights Reserved. · <SehasCredit />
          </p>
        </div>
      </section>
    </main>
  );
}