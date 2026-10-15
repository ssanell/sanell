import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DELETE_AFTER_MAP: Record<string, () => Date> = {
  "1h": () => new Date(Date.now() + 1000 * 60 * 60),
  "1d": () => new Date(Date.now() + 1000 * 60 * 60 * 24),
  "1w": () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { path, public_url, type, size, delete_after } = body;

    if (!path || !public_url || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const deleteAtFn = DELETE_AFTER_MAP[delete_after];
    const delete_at = deleteAtFn ? deleteAtFn().toISOString() : null;

    const { error: insertError } = await supabaseAdmin.from("assets").insert({
      user_id: user.id,
      path,
      public_url,
      type,
      size: size ?? 0,
      delete_at,
    });

    if (insertError) {
      console.error("SUPABASE INSERT ERROR:", insertError);

      const { error: storageError } = await supabaseAdmin.storage
        .from("assets-public")
        .remove([path]);

      if (storageError) {
        console.error("ORPHAN CLEANUP FAILED:", storageError);
      } else {
        console.log("Orphaned file cleaned up:", path);
      }

      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("API CRASH:", errorMessage, err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}