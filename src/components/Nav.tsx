"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Nav() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  
  // Track which menu is open by name ('tools' | 'playground' | null)
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setLoggedIn(!!user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleMouseEnter = (menuName: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setOpenMenu(menuName);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setOpenMenu(null);
    }, 150);
  };

  return (
    <header className="p-6 text-sm text-gray-500">
      <nav className="flex gap-6 items-center">
        <Link href="/" className="hover:text-black transition-colors">home</Link>
        <Link href="/works" className="hover:text-black transition-colors">works</Link>

        {/* Tools Dropdown */}
        <div
          className="relative"
          onMouseEnter={() => handleMouseEnter("tools")}
          onMouseLeave={handleMouseLeave}
        >
          <Link
            href="/tools"
            className="hover:text-black transition-colors flex items-center gap-1 py-1"
          >
            tools
            <span className={`text-xs transition-transform inline-block ${openMenu === "tools" ? "rotate-180" : ""}`}>
              ▾
            </span>
          </Link>

          {openMenu === "tools" && (
            <div className="absolute top-full left-0 pt-1 z-50">
              <div className="bg-white border rounded-lg shadow-lg py-1 min-w-[140px]">
                <Link
                  href="/tools/image-host"
                  className="block px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  image host
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Playground Dropdown */}
        <div
          className="relative"
          onMouseEnter={() => handleMouseEnter("playground")}
          onMouseLeave={handleMouseLeave}
        >
          <Link
            href="/playground"
            className="hover:text-black transition-colors flex items-center gap-1 py-1"
          >
            playground
            <span className={`text-xs transition-transform inline-block ${openMenu === "playground" ? "rotate-180" : ""}`}>
              ▾
            </span>
          </Link>

          {openMenu === "playground" && (
            <div className="absolute top-full left-0 pt-1 z-50">
              <div className="bg-white border rounded-lg shadow-lg py-1 min-w-[140px]">
                <Link
                  href="/playground/whiteboard"
                  className="block px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  whiteboard
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link href="/about" className="hover:text-black transition-colors">about</Link>

        {loggedIn && <Link href="/profile" className="hover:text-black transition-colors">profile</Link>}

        {loggedIn ? (
          <button onClick={handleLogout} className="hover:text-black underline">
            logout
          </button>
        ) : (
          <Link href="/login" className="hover:text-black transition-colors">login</Link>
        )}
      </nav>
    </header>
  );
}