"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/game", label: "Game" },
  { href: "/settings", label: "Settings" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-border bg-background/90 p-6 backdrop-blur md:flex">
      <div className="text-xl font-semibold text-foreground">QuizMaster AI</div>
      <p className="mt-2 text-xs text-slate-500">
        AI-powered quiz and flashcard studio
      </p>
      <nav className="mt-10 flex flex-col gap-2">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-muted text-foreground"
                  : "text-slate-500 hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
