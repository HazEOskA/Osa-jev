"use client";

import { cn } from "@/lib/utils";

const navItems = [
  { id: "tasks", label: "Zadania", icon: "📋" },
  { id: "plugins", label: "Wtyczki", icon: "🔌" },
  { id: "agents", label: "Agenci", icon: "🤖" },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border/40 bg-background/40 backdrop-blur">
      <div className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Nawigacja
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="border-t border-border/40 p-4">
        <div className="text-xs text-muted-foreground">
          v0.1.0 • feat/figma-agent-console
        </div>
      </div>
    </aside>
  );
}
