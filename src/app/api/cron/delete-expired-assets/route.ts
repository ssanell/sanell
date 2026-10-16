import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "assets-public";
const BATCH_SIZE = 500;

// Called by Vercel Cron (see vercel.json). proxy.ts skips /api/cron, so this
// route must authenticate itself. Vercel sends "Authorization: Bearer <CRON_SECRET>"
// when the CRON_SECRET environment variable is set on the project.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: expired, error: selectError } = await supabaseAdmin
    .from("assets")
    .select("id, path")
    .not("delete_at", "is", null)
    .lte("delete_at", new Date().toISOString())
    .limit(BATCH_SIZE);

  if (selectError) {
    console.error("CRON SELECT FAILED:", selectError);
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // Remove files first. If this fails, keep the rows so the next run retries.
  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(expired.map((a) => a.path));

  if (storageError) {
    console.error("CRON STORAGE DELETE FAILED:", storageError);
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("assets")
    .delete()
    .in("id", expired.map((a) => a.id));

  if (deleteError) {
    console.error("CRON ROW DELETE FAILED:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: expired.length });
}
