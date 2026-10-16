import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Called before the magic link is sent, to give a friendly "not on the invite list"
// message. NOTE: this is only a UX check. The real enforcement must live in Supabase
// (see supabase/security-hardening.sql), because anyone can call Supabase auth directly.
export async function POST(req: Request) {
  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof email !== "string" || !email.trim() || email.length > 320) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("allowed_emails")
    .select("email")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "This email is not on the invite list." }, { status: 403 });
  }

  return NextResponse.json({ allowed: true });
}
