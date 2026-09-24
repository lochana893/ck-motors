"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import SehasCredit from "@/components/SehasCredit";
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
   const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) {
        setError("Email or password is incorrect.");
        return;
      }

      if (!data.user) {
        setError("Unable to login. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status, must_change_password")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn("Authenticated user profile query failed:", {
          userId: data.user.id,
          code: profileError.code,
          message: profileError.message,
        });
        await supabase.auth.signOut();
        setError(
          profileError.code === "42501"
            ? "Your account is authenticated, but profile access is not configured. Please contact CK Motors."
            : "Unable to load your account profile. Please contact CK Motors.",
        );
        return;
      }

      if (!profile) {
        console.warn("Authenticated user has no matching profile:", {
          authUserId: data.user.id,
        });
        await supabase.auth.signOut();
        setError(
          "Your login is valid, but no matching CK Motors customer profile was found. Please contact CK Motors.",
        );
        return;
      }

      if (profile.status === "disabled") {
        await supabase.auth.signOut();
        setError(
          "Your account has been disabled. Please contact CK Motors."
        );
        return;
      }

      if (profile.must_change_password === true && profile.role === "customer") {
        router.replace("/complete-account");
      } else if (profile.role === "admin" || profile.role === "staff") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }

      router.refresh();
    } catch (loginError) {
      console.warn("Unexpected customer login error:", loginError);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <AuthHeader />

      {/* Login */}
      <section className="relative flex min-h-[calc(100vh-65px)] items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-700/10 blur-[120px]" />

        <div className="relative w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="mb-3 inline-flex rounded-full border border-red-200 bg-red-50 px-4 py-1 text-[10px] font-bold tracking-[0.18em] text-red-600">
              CUSTOMER LOGIN
            </div>

            <h1 className="text-3xl font-black">
              Welcome Back to{" "}
              <span className="text-red-500">CK Motors</span>
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Login to manage your vehicles, service bookings and maintenance
              history.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-600"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-red-500 transition hover:text-red-400"
                  >
                    Forgot Password?
                  </Link>
                </div>

               <div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="Enter your password"
    autoComplete="current-password"
    required
    className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none focus:border-red-600"
  />

  <button
    type="button"
    onClick={() => setShowPassword((current) => !current)}
    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition hover:text-red-500"
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? (
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

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="my-5 h-px bg-white/10" />

            <p className="text-center text-xs text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-bold text-red-500 hover:text-red-400"
              >
                Create Account
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