import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function isAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", user.id).single();
  return !!data?.is_admin;
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin.from("whiteboard_strokes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}