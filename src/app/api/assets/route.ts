import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerUser } from "@/lib/serverAuth";

const BUCKET = "assets-public";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DELETE_AFTER_MAP: Record<string, () => Date> = {
  "1h": () => new Date(Date.now() + 1000 * 60 * 60),
  "1d": () => new Date(Date.now() + 1000 * 60 * 60 * 24),
  "1w": () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
};

// Uploads must live at "<user id>/<uuid>.<ext>". Anything else is rejected, so a
// user can only ever register (or trigger cleanup of) their own files.
const FILE_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/;

export async function POST(req: Request) {
  try {
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { path, type, size, delete_after } = body;

    // 1. Validate the path first. If this fails we touch nothing.
    const prefix = `${user.id}/`;
    if (
      typeof path !== "string" ||
      !path.startsWith(prefix) ||
      !FILE_NAME_RE.test(path.slice(prefix.length))
    ) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // 2. The path is verified as the caller's own, so cleanup on failure is safe.
    const rejectAndCleanup = async (message: string, status = 400) => {
      const { error: storageError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([path]);
      if (storageError) console.error("ORPHAN CLEANUP FAILED:", storageError);
      return NextResponse.json({ error: message }, { status });
    };

    if (typeof type !== "string" || !type.startsWith("image/") || type.length > 100) {
      return rejectAndCleanup("Only image files are supported.");
    }

    const fileSize = typeof size === "number" ? size : 0;
    if (!Number.isFinite(fileSize) || fileSize < 0 || fileSize > MAX_FILE_SIZE) {
      return rejectAndCleanup("File must be under 10MB.");
    }

    const deleteAtFn =
      typeof delete_after === "string" ? DELETE_AFTER_MAP[delete_after] : undefined;
    const delete_at = deleteAtFn ? deleteAtFn().toISOString() : null;

    // Build the public URL on the server instead of trusting the client's.
    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    const { error: insertError } = await supabaseAdmin.from("assets").insert({
      user_id: user.id,
      path,
      public_url: urlData.publicUrl,
      type,
      size: Math.round(fileSize),
      delete_at,
    });

    if (insertError) {
      console.error("SUPABASE INSERT ERROR:", insertError);
      return rejectAndCleanup(insertError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("API CRASH:", errorMessage, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
