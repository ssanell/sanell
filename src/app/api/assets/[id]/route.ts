import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerUser } from "@/lib/serverAuth";

const BUCKET = "assets-public";

// Deletes one of the caller's own assets (storage file + database row).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Scoped to user_id so nobody can delete someone else's asset.
  const { data: asset, error: findError } = await supabaseAdmin
    .from("assets")
    .select("id, path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (findError || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove([asset.path]);

  if (storageError) {
    console.error("STORAGE DELETE FAILED:", storageError);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("ASSET ROW DELETE FAILED:", deleteError);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
