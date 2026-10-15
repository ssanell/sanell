"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse error from URL hash if present
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      setError(errorDescription.replace(/\+/g, " "));
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.replace("/profile");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (error) {
    return (
      <main className="p-8 max-w-sm mx-auto mt-24 text-center space-y-4">
        <h1 className="text-2xl font-bold">Login failed</h1>
        <p className="text-red-500">{error}</p>
        <a href="/login" className="text-sm underline text-gray-500 hover:text-black">
          Back to login
        </a>
      </main>
    );
  }

  return (
    <main className="p-8">
      <p>Logging you in…</p>
    </main>
  );
}