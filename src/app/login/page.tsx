"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/profile");
      }
    };

    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check allowlist before sending magic link
    const check = await fetch("/api/auth/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!check.ok) {
      const result = await check.json();
      setError(result.error || "You are not on the invite list.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <main className="p-8 max-w-md mx-auto mt-24 text-center space-y-2">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-gray-500">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
        >
          {loading ? "Checking…" : "Send magic link"}
        </button>
      </form>

      {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
    </main>
  );
}