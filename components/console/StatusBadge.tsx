import { cn } from "@/lib/utils";

type Status = "idle" | "working" | "waiting" | "error";
type Worker = "hermes" | "jev" | "cline";

const statusColors: Record<Status, string> = {
  idle: "bg-gray-400",
  working: "bg-green-500",
  waiting: "bg-yellow-500",
  error: "bg-red-500",
};

const workerLabels: Record<Worker, string> = {
  hermes: "Hermes",
  jev: "JEV",
  cline: "Cline",
};

export function StatusBadge({
  status,
  worker,
}: {
  status: Status;
  worker: Worker;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
      <span className={cn("h-1.5 w-1.5 rounded-full", statusColors[status])} />
      {workerLabels[worker]}
    </span>
  );
}
