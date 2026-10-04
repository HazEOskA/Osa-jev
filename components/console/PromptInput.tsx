"use client";

import { useState } from "react";

export function PromptInput() {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (!value.trim()) return;
    console.log("[PROMPT]", value);
    setValue("");
  };

  return (
    <div className="border-t border-border/40 bg-background/60 p-4 backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Wpisz polecenie dla Hermes/JEV/Cline..."
          className="flex-1 rounded-md border border-border/40 bg-background/80 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <button
          onClick={handleSubmit}
          className="rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Wyślij
        </button>
      </div>
    </div>
  );
}
