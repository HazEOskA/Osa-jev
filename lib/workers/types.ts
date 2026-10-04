export type WorkerStatus = "idle" | "working" | "waiting" | "error";

export type WorkerName = "hermes" | "jev" | "cline";

export interface WorkerState {
  name: WorkerName;
  status: WorkerStatus;
  currentTask?: string;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Task {
  id: string;
  type: "research" | "code" | "orchestrate";
  payload: unknown;
  createdAt: number;
}
