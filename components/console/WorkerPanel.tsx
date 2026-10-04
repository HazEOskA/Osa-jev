"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "workers", label: "Workery" },
  { id: "terminal", label: "Terminal" },
  { id: "browser", label: "Przeglądarka" },
];

export function WorkerPanel() {
  const [activeTab, setActiveTab] = useState("workers");

  return (
    <aside className="flex w-80 flex-col border-l border-border/40 bg-background/40 backdrop-blur">
      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "workers" && <WorkersTab />}
        {activeTab === "terminal" && <TerminalTab />}
        {activeTab === "browser" && <BrowserTab />}
      </div>
    </aside>
  );
}

function WorkersTab() {
  const workers = [
    { name: "Hermes", status: "working", task: "Orchestrating..." },
    { name: "JEV", status: "idle", task: "Ready" },
    { name: "Cline", status: "waiting", task: "Awaiting input" },
  ];

  return (
    <div className="space-y-3">
      {workers.map((w) => (
        <div
          key={w.name}
          className="rounded-md border border-border/40 bg-background/60 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{w.name}</span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                w.status === "working" && "bg-green-500",
                w.status === "idle" && "bg-gray-400",
                w.status === "waiting" && "bg-yellow-500"
              )}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{w.task}</div>
        </div>
      ))}
    </div>
  );
}

function TerminalTab() {
  return (
    <div className="font-mono text-xs">
      <div className="text-muted-foreground">$ worker:hermes start</div>
      <div className="mt-1 text-green-400">✓ Hermes online</div>
      <div className="mt-1 text-muted-foreground">$ worker:jev ready</div>
      <div className="mt-1 text-green-400">✓ JEV ready</div>
      <div className="mt-1 text-muted-foreground">$ worker:cline standby</div>
      <div className="mt-1 text-yellow-400">⏳ Cline waiting</div>
    </div>
  );
}

function BrowserTab() {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Preview URL</div>
      <div className="rounded-md border border-border/40 bg-background/60 p-2 text-xs">
        https://console.botbuzz.local
      </div>
      <button className="w-full rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
        Open Preview
      </button>
    </div>
  );
}
