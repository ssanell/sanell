"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Session may have expired since the proxy ran.
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setEditName(profile.display_name ?? "");
        setEditBio(profile.bio ?? "");
        setAvatarPreview(profile.avatar_url ?? null);
        setCurrentAvatarUrl(profile.avatar_url ?? null);
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setSaving(false);
      return;
    }

    let avatar_url = currentAvatarUrl;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const path = `avatars/${user.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("assets-public")
        .upload(path, avatarFile, { upsert: true });

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("assets-public")
        .getPublicUrl(path);

      // The path is reused on every upload, so add a version to bypass cached copies.
      avatar_url = `${urlData.publicUrl}?v=${Date.now()}`;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: editName || null,
        bio: editBio || null,
        avatar_url,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/profile"), 1000);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400 tracking-widest animate-pulse">loading...</p>
      </div>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-16 space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/profile")}
          className="text-sm text-gray-400 hover:text-black transition-colors"
        >
          ← back
        </button>
        <h1 className="text-2xl font-bold">edit profile</h1>
      </div>

      <div className="flex items-center gap-6">
        <div
          className="relative group w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
              ?
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs">
            change
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-gray-400 mt-0.5">Max 2MB</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs underline text-gray-500 hover:text-black mt-1"
          >
            upload new photo
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 uppercase tracking-widest">display name</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="your name"
            className="w-full border-b border-gray-200 focus:border-black outline-none py-2 text-sm transition-colors bg-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 uppercase tracking-widest">bio</label>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="say something about yourself..."
            rows={4}
            className="w-full border-b border-gray-200 focus:border-black outline-none py-2 text-sm transition-colors bg-transparent resize-none"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {success && <p className="text-xs text-green-500">saved! redirecting...</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-black text-white px-6 py-2 rounded-full text-sm disabled:opacity-50 hover:bg-gray-800 transition-colors"
      >
        {saving ? "saving..." : "save changes"}
      </button>
    </main>
  );
}