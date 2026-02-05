"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
     const { data } = await supabase.auth.getSession();

     if (data.session) {
      router.replace("/dashboard");
     }
    };

    checkSession();
  }, [router]);

  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
     email,
     options: {
      emailRedirectTo: `${location.origin}/auth/callback`,
     },
    });

    if (error) {
      setError(error.message);
    } else {
      alert("Check your email for the login link.");
    }

    setLoading(false);
  };

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="you@sanell.online"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded"
        >
          {loading ? "Sending link…" : "Send magic link"}
        </button>
      </form>

      {error && (
        <p className="text-red-500 mt-4 text-sm">{error}</p>
      )}
    </main>
  );
}
