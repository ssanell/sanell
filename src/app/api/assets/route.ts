import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

console.log(
  "SERVICE KEY:",
  process.env.SUPABASE_SECRET_KEY ? "FOUND" : "MISSING"
);

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const body = await req.json();
    const { user_id, path, public_url, type, delete_at } = body;

    const { error } = await supabase.from("assets").insert({
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
    console.error("API CRASH:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
