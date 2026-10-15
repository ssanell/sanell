"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Stats = {
  uploadCount: number;
  storageUsed: number;
};

type Asset = {
  id: string;
  public_url: string;
  path: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [stats, setStats] = useState<Stats>({ uploadCount: 0, storageUsed: 0 });
  const [profile, setProfile] = useState<Profile>({
    display_name: null,
    bio: null,
    avatar_url: null,
  });
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      setEmail(user!.email ?? "");
      setJoinDate(user!.created_at);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (profileData) setProfile(profileData);

      const { data: assets } = await supabase
        .from("assets")
        .select("id, public_url, path, size")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      const totalSize = assets?.reduce((sum, a) => sum + (a.size ?? 0), 0) ?? 0;

      setStats({
        uploadCount: assets?.length ?? 0,
        storageUsed: totalSize,
      });

      setRecentAssets((assets ?? []).slice(0, 6));
      setLoading(false);
    };

    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400 tracking-widest animate-pulse">loading...</p>
      </div>
    );
  }

  const displayName = profile.display_name || email.split("@")[0];

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-12">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">profile</p>
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
            <p className="text-sm text-gray-400 mt-1">{email}</p>
          </div>
          <div className="flex gap-4 mt-1">
            <button
              onClick={() => router.push("/profile/settings")}
              className="text-xs text-gray-400 hover:text-black underline underline-offset-4 transition-colors"
            >
              edit profile
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-black underline underline-offset-4 transition-colors"
            >
              sign out
            </button>
          </div>
        </div>

        {/* Avatar + Stats */}
        <div className="flex gap-8 items-center">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300 select-none">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.uploadCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">uploads</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatBytes(stats.storageUsed)}</p>
              <p className="text-xs text-gray-400 mt-0.5">storage</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{formatDate(joinDate)}</p>
              <p className="text-xs text-gray-400 mt-0.5">joined</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-4">
            {profile.bio}
          </p>
        )}

        {/* Gallery preview */}
        <div className="border-t pt-8 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">gallery</p>
            {recentAssets.length > 0 && (
              <button
                onClick={() => router.push("/gallery")}
                className="text-xs text-gray-400 hover:text-black underline underline-offset-4 transition-colors"
              >
                view all →
              </button>
            )}
          </div>

          {recentAssets.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <p className="text-sm text-gray-400 mb-3">no uploads yet</p>
              <button
                onClick={() => router.push("/tools/image-host")}
                className="text-xs bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors"
              >
                + upload your first image
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {recentAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => router.push("/gallery")}
                >
                  <img
                    src={asset.public_url}
                    alt={asset.path}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}