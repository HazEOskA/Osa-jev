"use client";

import { ChatPanel } from "@/components/console/ChatPanel";
import { PromptInput } from "@/components/console/PromptInput";

export default function ConsolePage() {
  return (
    <div className="flex h-full flex-col">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500" />
          <span className="text-sm font-semibold">BotBuzz Console</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Hermes • JEV • Cline
        </div>
      </header>

      {/* Chat Area */}
      <ChatPanel />

      {/* Prompt Input */}
      <PromptInput />
    </div>
  );
}
