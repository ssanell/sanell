"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useRef, useState, useCallback } from "react";

type Point = { x: number; y: number };

type Stroke = {
  id: string;
  user_id: string;
  color: string;
  points: Point[];
  brush_size: number;
  tool: string;
};

type LiveCursor = {
  user_id: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

const BRUSH_SIZE = 6;
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.brush_size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

export default function WhiteboardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef<Point[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myStrokeIds = useRef<string[]>([]); // track own stroke IDs for undo

  const [user, setUser] = useState<{ id: string; color: string; name: string } | null>(null);
  const [liveCursors, setLiveCursors] = useState<Record<string, LiveCursor>>({});
  const [loaded, setLoaded] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);

  const redrawAll = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { data: strokes } = await supabase
      .from("whiteboard_strokes")
      .select("*")
      .order("created_at", { ascending: true });

    if (strokes) {
      strokes.forEach((s) => drawStroke(ctx, s));
      setStrokeCount(strokes.length);
    }
  }, []);

  const loadStrokes = useCallback(async () => {
    await redrawAll();
    setLoaded(true);
  }, [redrawAll]);

  useEffect(() => {
    const init = async () => {
      // Strokes are public, so load them for logged-out visitors too.
      // Not awaited: the canvas and the user lookup load in parallel.
      loadStrokes();

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, marker_color")
        .eq("id", authUser.id)
        .single();

      setUser({
        id: authUser.id,
        color: profile?.marker_color ?? "#000000",
        name: profile?.display_name ?? authUser.email?.split("@")[0] ?? "anon",
      });
    };

    init();
  }, [loadStrokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const channel = supabase.channel("whiteboard", {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        drawStroke(ctx, payload.stroke);
        setStrokeCount((c) => c + 1);
      })
      .on("broadcast", { event: "undo" }, () => {
        // Someone undid — redraw everything from DB
        redrawAll();
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        setLiveCursors((prev) => ({ ...prev, [payload.user_id]: payload }));
      })
      .on("broadcast", { event: "cursor_leave" }, ({ payload }) => {
        setLiveCursors((prev) => {
          const next = { ...prev };
          delete next[payload.user_id];
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [redrawAll]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!user) return;
    isDrawing.current = true;
    const pos = getPos(e);
    currentStroke.current = [pos];
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!user) return;
    const pos = getPos(e);

    channelRef.current?.send({
      type: "broadcast",
      event: "cursor",
      payload: { user_id: user.id, name: user.name, color: user.color, x: pos.x, y: pos.y },
    });

    if (!isDrawing.current) return;
    currentStroke.current.push(pos);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pts = currentStroke.current;

    ctx.strokeStyle = user.color;
    ctx.lineWidth = BRUSH_SIZE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = async () => {
    if (!isDrawing.current || !user || currentStroke.current.length < 2) {
      isDrawing.current = false;
      return;
    }
    isDrawing.current = false;

    const strokeId = crypto.randomUUID();
    const stroke: Stroke = {
      id: strokeId,
      user_id: user.id,
      color: user.color,
      points: currentStroke.current,
      brush_size: BRUSH_SIZE,
      tool: "pen",
    };

    channelRef.current?.send({
      type: "broadcast",
      event: "stroke",
      payload: { stroke },
    });

    const { data } = await supabase
      .from("whiteboard_strokes")
      .insert(stroke)
      .select("id")
      .single();

    if (data?.id) {
      myStrokeIds.current.push(data.id);
      setCanUndo(true);
    }

    setStrokeCount((c) => c + 1);
    currentStroke.current = [];
  };

  const handleUndo = async () => {
    if (!user || myStrokeIds.current.length === 0) return;

    const lastId = myStrokeIds.current.pop();
    setCanUndo(myStrokeIds.current.length > 0);

    await supabase
      .from("whiteboard_strokes")
      .delete()
      .eq("id", lastId);

    // Redraw locally first
    await redrawAll();

    // Broadcast after so others get the clean state
    channelRef.current?.send({
      type: "broadcast",
      event: "undo",
      payload: {},
    });
  };

  const handleMouseLeave = () => {
    if (!user) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "cursor_leave",
      payload: { user_id: user.id },
    });
    stopDrawing();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-b">
        <h1 className="text-sm font-bold tracking-tight">guestbook</h1>

        {user && (
          <>
            <div className="flex items-center gap-2 ml-4">
              <div
                className="w-4 h-4 rounded-full border border-gray-200"
                style={{ backgroundColor: user.color }}
              />
              <span className="text-xs text-gray-500">{user.name}</span>
            </div>

            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="px-3 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ↩ undo
            </button>
          </>
        )}

        {!user && (
          <a href="/login" className="ml-4 text-xs text-gray-400 underline hover:text-black">
            log in to draw
          </a>
        )}

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1">
            {Object.values(liveCursors).map((c) => (
              <div
                key={c.user_id}
                className="w-5 h-5 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: c.color }}
                title={c.name}
              />
            ))}
            {Object.keys(liveCursors).length > 0 && (
              <span className="text-xs text-gray-400 ml-1">
                {Object.keys(liveCursors).length} drawing
              </span>
            )}
          </div>
          <span className="text-xs text-gray-300">{strokeCount} strokes</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <p className="text-sm text-gray-400 animate-pulse">loading canvas...</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full"
          style={{
            cursor: user ? "crosshair" : "not-allowed",
            touchAction: "none",
          }}
          onMouseDown={user ? startDrawing : undefined}
          onMouseMove={user ? draw : undefined}
          onMouseUp={user ? stopDrawing : undefined}
          onMouseLeave={handleMouseLeave}
          onTouchStart={user ? startDrawing : undefined}
          onTouchMove={user ? draw : undefined}
          onTouchEnd={user ? stopDrawing : undefined}
        />

        {/* Live cursors */}
        {/* The canvas stretches to fill this container, so percentages of the
            canvas coordinate space line up exactly (no ref reads during render). */}
        {Object.values(liveCursors).map((cursor) => {
          return (
            <div
              key={cursor.user_id}
              className="absolute pointer-events-none flex items-center gap-1"
              style={{
                left: `${(cursor.x / CANVAS_WIDTH) * 100}%`,
                top: `${(cursor.y / CANVAS_HEIGHT) * 100}%`,
                transform: "translate(8px, 8px)",
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cursor.color }} />
              <span
                className="text-xs px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}