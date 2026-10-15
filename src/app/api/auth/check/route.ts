import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Called before magic link is sent to check if email is allowed
export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
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