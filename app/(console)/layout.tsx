"use client";

import { Sidebar } from "@/components/console/Sidebar";
import { WorkerPanel } from "@/components/console/WorkerPanel";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {/* Right Worker Panel */}
      <WorkerPanel />
    </div>
  );
}
