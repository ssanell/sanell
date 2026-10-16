import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/lib/serverAuth";

// Admin-only: change a user's whiteboard marker color.
// Done server-side so the profiles table doesn't need to let browsers
// update other users' rows.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let color: unknown;
  try {
    ({ color } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ marker_color: color })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
