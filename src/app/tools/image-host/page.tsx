"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState, useRef, useEffect } from "react";

type Asset = {
  id: string;
  path: string;
  public_url: string;
  type: string;
  delete_at: string | null;
  created_at: string;
};

function formatExpiry(deleteAt: string | null): string {
  if (!deleteAt) return "Never expires";
  const date = new Date(deleteAt);
  // Shown in the viewer's own time zone, e.g. "Oct 17, 2026, 3:42 PM"
  const when = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return date.getTime() <= Date.now() ? `Expired ${when}` : `Expires ${when}`;
}

export default function ImageHostPage() {
  // uploader state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteAfter, setDeleteAfter] = useState("never");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // gallery state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const applyFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Only image files are supported.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File must be under 10MB.");
      return;
    }
    setError(null);
    setFile(f);
    setUploadedUrl(null);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    applyFile(droppedFile);
  };

  async function loadAssets() {
    // loadingAssets starts as true, so the first load needs no setState here.
    // The refresh button turns the spinner on itself.
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAssets([]);
        setDisplayName("");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      setDisplayName(profile?.display_name || user.email?.split("@")[0] || "your");

      const { data, error: fetchError } = await supabase
        .from("assets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setAssets(data ?? []);
      }
    } catch {
      setError("Failed to load assets.");
    } finally {
      setLoadingAssets(false);
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadAssets();
    };
    init();
  }, []);

  // Free the preview's object URL whenever it changes or the page unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user || userError) {
        setError("You must be logged in.");
        return;
      }

      // Files live in the user's own folder. The server only accepts
      // "<user id>/<uuid>.<ext>" paths.
      const fileId = crypto.randomUUID();
      const rawExt = file.name.split(".").pop() ?? "";
      const fileExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "img";
      const filePath = `${user.id}/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("assets-public")
        .upload(filePath, file);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("assets-public")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      const payload = {
        path: filePath,
        type: file.type,
        size: file.size,
        delete_after: deleteAfter,
      };

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to save asset.");
        return;
      }

      setUploadedUrl(publicUrl);
      setFile(null);
      setPreviewUrl(null);
      // reload gallery
      await loadAssets();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!uploadedUrl) return;
    navigator.clipboard.writeText(uploadedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (asset: Asset) => {
    setDeletingId(asset.id);

    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });

      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      } else {
        const result = await res.json().catch(() => null);
        alert(result?.error || "Failed to delete.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="p-8 max-w-4xl mx-auto space-y-6"
    >
      {isDragging && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-none">
          <div className="border-2 border-dashed border-white rounded-xl p-12 text-white text-xl font-semibold bg-black/40">
            Drop your image here
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Image Hosting</h1>
        <div />
      </div>

      <p className="text-gray-500">Drag and drop your image anywhere here or choose a file below.</p>

      <div className="flex flex-col gap-4">
        <div className="w-full">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) applyFile(f);
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="border px-4 py-2 rounded">
              Choose Image
            </button>

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
              disabled={!file || loading}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {previewUrl && !uploadedUrl && (
            <div className="space-y-1 mt-3">
              <p className="text-sm text-gray-600">Selected: {file?.name}</p>
              <img src={previewUrl} alt="Preview" className="max-h-48 rounded border" />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {uploadedUrl && (
            <div className="space-y-3 border p-4 rounded mt-3">
              <img src={uploadedUrl} alt="Uploaded image" className="max-h-64 rounded" />
              <div className="flex gap-2">
                <input value={uploadedUrl} readOnly className="border px-2 py-1 flex-1 rounded" />
                <button onClick={handleCopy} className="bg-gray-200 px-3 rounded">{copied ? "Copied!" : "Copy"}</button>
              </div>
            </div>
          )}
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{displayName ? `${displayName}'s gallery` : 'Gallery'}</h2>
            <button
              onClick={() => {
                setLoadingAssets(true);
                loadAssets();
              }}
              className="text-sm bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors"
            >
              refresh
            </button>
          </div>

          {loadingAssets ? (
            <p className="text-gray-400 text-sm">loading...</p>
          ) : assets.length === 0 ? (
            <p className="text-gray-400 text-sm">no uploads yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
              {assets.map((asset) => (
                <div key={asset.id} className="border rounded overflow-hidden flex flex-col">
                  <img
                    src={asset.public_url}
                    alt={asset.path}
                    className="w-full h-36 object-cover"
                  />
                  <div className="p-2 flex flex-col gap-1 flex-1">
                    <p className="text-xs text-gray-700 truncate" title={asset.path}>
                      {asset.path}
                    </p>
                    <p className="text-xs text-gray-400">{formatExpiry(asset.delete_at)}</p>
                    <button
                      onClick={() => handleDelete(asset)}
                      disabled={deletingId === asset.id}
                      className="mt-auto text-xs text-red-500 hover:underline disabled:opacity-50 text-left"
                    >
                      {deletingId === asset.id ? "deleting..." : "delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}