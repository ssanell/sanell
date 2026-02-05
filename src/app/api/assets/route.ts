import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, path, public_url, type, delete_at } = body;

    const { error } = await supabaseAdmin.from("assets").insert({
      user_id,
      path,
      public_url,
      type,
      delete_at,
    });

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("API CRASH:", errorMessage, err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
