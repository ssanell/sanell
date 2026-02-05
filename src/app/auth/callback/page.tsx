"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finishLogin = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        console.error(error);
        return;
      }

      // login successful → go somewhere useful
      router.replace("/dashboard");
    };

    finishLogin();
  }, [router]);

  return (
    <main className="p-8">
      <p>Logging you in…</p>
    </main>
  );
}
