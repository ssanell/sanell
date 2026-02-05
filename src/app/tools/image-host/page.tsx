"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ImageHostPage() {
  const [file, setFile] = useState<File | null>(null);
  const [deleteAfter, setDeleteAfter] = useState("never");

  const handleUpload = async () => {
  if (!file) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    alert("You must be logged in");
    return;
  }

  // extension (safe)
  const ext = file.name.split(".").pop() || "bin";

  // filename + path
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = filename;

  // upload
  const { error: uploadError } = await supabase.storage
    .from("assets-public")
    .upload(path, file);

  if (uploadError) {
    alert(uploadError.message);
    return;
  }

  const { data: publicData } = supabase.storage
    .from("assets-public")
    .getPublicUrl(path);

  const publicUrl = publicData.publicUrl;

  // compute delete_at
  let delete_at: string | null = null;
  if (deleteAfter !== "never") {
    const now = new Date();
    if (deleteAfter === "1h") now.setHours(now.getHours() + 1);
    if (deleteAfter === "1d") now.setDate(now.getDate() + 1);
    if (deleteAfter === "1w") now.setDate(now.getDate() + 7);
    delete_at = now.toISOString();
  }

  // 👇 NOW it exists, so logging is safe
  console.log("INSERT PAYLOAD:", {
    user_id: user.id,
    path,
    public_url: publicUrl,
    type: file.type,
    delete_at,
  });

  const res = await fetch("/api/assets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    user_id: user.id,
    path,
    public_url: publicUrl,
    type: file.type,
    delete_at,
  }),
});

const result = await res.json();

if (!res.ok) {
  alert(result.error || "Failed to save asset");
  return;
}

  alert(publicUrl);
};

  return (
    <main className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Image Hosting</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <select
        value={deleteAfter}
        onChange={(e) => setDeleteAfter(e.target.value)}
        className="border rounded px-2 py-1"
      >
        <option value="never">Never delete</option>
        <option value="1h">Delete after 1 hour</option>
        <option value="1d">Delete after 1 day</option>
        <option value="1w">Delete after 1 week</option>
      </select>

      <button
         onClick={handleUpload}
         disabled={!file}
         className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Upload
      </button>

    </main>
  );
}
