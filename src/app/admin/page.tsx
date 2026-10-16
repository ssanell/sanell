"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const PALETTE = [
  { hex: "#5F4037", name: "beaver bum" },
  { hex: "#66665B", name: "evil beavers" },
  { hex: "#74B1A3", name: "computer teal" },
  { hex: "#7AD6C7", name: "my blue" },
  { hex: "#9CBFBF", name: "feeling blue" },
  { hex: "#BDA8B6", name: "lilac sheen" },
  { hex: "#DE91AD", name: "pink jammies" },
  { hex: "#FF7AA4", name: "bubble bum" },
  { hex: "#A85735", name: "cakalang fufu" },
  { hex: "#833C2B", name: "beaver brown" },
  { hex: "#5D2121", name: "sambal roa" },
  { hex: "#5E362C", name: "choccy milk" },
  { hex: "#5F5039", name: "sofa brown" },
  { hex: "#5F7443", name: "grouchy green" },
];

type Stroke = {
  id: string;
  user_id: string;
  color: string;
  created_at: string;
  points: { x: number; y: number }[];
  tool: string;
};

type UserEntry = {
  user_id: string;
  name: string;
  color: string;
  strokeCount: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [view, setView] = useState<"strokes" | "users">("users");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [savingColor, setSavingColor] = useState(false);

  const loadData = useCallback(async () => {
    const { data: strokeData } = await supabase
      .from("whiteboard_strokes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!strokeData) return;
    setStrokes(strokeData);

    const userMap: Record<string, UserEntry> = {};
    const profileIds = [...new Set(strokeData.map((s) => s.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, marker_color")
      .in("id", profileIds);

    for (const s of strokeData) {
      if (!userMap[s.user_id]) {
        const profile = profiles?.find((p) => p.id === s.user_id);
        userMap[s.user_id] = {
          user_id: s.user_id,
          name: profile?.display_name ?? s.user_id.slice(0, 8),
          color: profile?.marker_color ?? s.color,
          strokeCount: 0,
        };
      }
      userMap[s.user_id].strokeCount++;
    }

    setUsers(Object.values(userMap).sort((a, b) => b.strokeCount - a.strokeCount));
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Session may have expired since the proxy ran.
      if (!user) {
        router.replace("/login");
        return;
      }

      // Proxy already guards against unauthenticated access,
      // but we still need to check is_admin here
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        router.replace("/");
        return;
      }

      setAuthorized(true);
      await loadData();
      setLoading(false);
    };

    init();
  }, [router, loadData]);

  const deleteStroke = async (id: string) => {
    const stroke = strokes.find((s) => s.id === id);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/admin/strokes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete stroke.");
        return;
      }

      setStrokes((prev) => prev.filter((s) => s.id !== id));
      setUsers((prev) =>
        prev
          .map((u) =>
            stroke && u.user_id === stroke.user_id
              ? { ...u, strokeCount: u.strokeCount - 1 }
              : u
          )
          .filter((u) => u.strokeCount > 0)
      );
    } finally {
      setDeletingId(null);
    }
  };

  const deleteUserStrokes = async (userId: string) => {
    setDeletingUserId(userId);

    try {
      const res = await fetch(`/api/admin/strokes/user/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete strokes.");
        return;
      }

      setStrokes((prev) => prev.filter((s) => s.user_id !== userId));
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    } finally {
      setDeletingUserId(null);
    }
  };

  const changeUserColor = async (userId: string, newColor: string) => {
    setSavingColor(true);

    try {
      const res = await fetch(`/api/admin/profiles/${userId}/color`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: newColor }),
      });

      if (!res.ok) {
        alert("Failed to change color.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, color: newColor } : u))
      );
      setColorPickerFor(null);
    } finally {
      setSavingColor(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400 animate-pulse">loading...</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-1">admin</p>
        <h1 className="text-2xl font-bold">whiteboard moderation</h1>
        <p className="text-sm text-gray-400 mt-1">{strokes.length} total strokes</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setView("users")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            view === "users" ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          by user
        </button>
        <button
          onClick={() => setView("strokes")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            view === "strokes" ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          all strokes
        </button>
      </div>

      {view === "users" && (
        <div className="space-y-3">
          {users.length === 0 && <p className="text-sm text-gray-400">no strokes yet.</p>}
          {users.map((u) => (
            <div key={u.user_id} className="border rounded-lg px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: u.color }}
                    onClick={() => setColorPickerFor(colorPickerFor === u.user_id ? null : u.user_id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.strokeCount} strokes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setColorPickerFor(colorPickerFor === u.user_id ? null : u.user_id)}
                    className="text-xs text-gray-400 hover:text-black underline"
                  >
                    change color
                  </button>
                  <button
                    onClick={() => deleteUserStrokes(u.user_id)}
                    disabled={deletingUserId === u.user_id}
                    className="text-xs text-red-500 hover:underline disabled:opacity-40"
                  >
                    {deletingUserId === u.user_id ? "deleting..." : "delete all strokes"}
                  </button>
                </div>
              </div>

              {colorPickerFor === u.user_id && (
                <div className="space-y-2 pt-1 border-t">
                  <p className="text-xs text-gray-400">pick a color from the palette:</p>
                  <div className="flex flex-wrap gap-2">
                    {PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => changeUserColor(u.user_id, c.hex)}
                        disabled={savingColor}
                        title={c.name}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-50 ${
                          u.color === c.hex ? "border-black" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-300 italic">
                    current: {PALETTE.find((c) => c.hex === u.color)?.name ?? u.color}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "strokes" && (
        <div className="space-y-2">
          {strokes.length === 0 && <p className="text-sm text-gray-400">no strokes yet.</p>}
          {strokes.map((s) => {
            const u = users.find((u) => u.user_id === s.user_id);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between border rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <div>
                    <p className="text-xs font-medium">{u?.name ?? s.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleString()} · {s.points.length} points
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteStroke(s.id)}
                  disabled={deletingId === s.id}
                  className="text-xs text-red-500 hover:underline disabled:opacity-40"
                >
                  {deletingId === s.id ? "deleting..." : "delete"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}