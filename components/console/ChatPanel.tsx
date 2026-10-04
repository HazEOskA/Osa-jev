"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  worker?: "hermes" | "jev" | "cline";
  timestamp: number;
};

const initialMessages: Message[] = [
  {
    id: "1",
    role: "system",
    content: "Hermes initialized. Ready to orchestrate tasks.",
    worker: "hermes",
    timestamp: Date.now() - 60000,
  },
  {
    id: "2",
    role: "user",
    content: "Przeanalizuj repozytorium i przygotuj plan refaktoryzacji.",
    timestamp: Date.now() - 55000,
  },
  {
    id: "3",
    role: "assistant",
    content: "JEV zakończył analizę. Znaleziono 3 obszary do poprawy: (1) wydajność zapytań, (2) struktura komponentów, (3) testy.",
    worker: "jev",
    timestamp: Date.now() - 50000,
  },
];

export function ChatPanel() {
  const [messages] = useState<Message[]>(initialMessages);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 rounded-lg p-3",
              msg.role === "user" && "bg-accent/50",
              msg.role === "assistant" && "bg-muted/30",
              msg.role === "system" && "border border-border/40 bg-background/60"
            )}
          >
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium capitalize">
                  {msg.role}
                </span>
                {msg.worker && (
                  <StatusBadge
                    status={msg.worker === "hermes" ? "working" : "idle"}
                    worker={msg.worker}
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
