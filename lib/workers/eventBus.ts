export type WorkerEvent =
  | { type: "task:queued"; worker: "hermes" | "jev" | "cline"; taskId: string }
  | { type: "task:started"; worker: "hermes" | "jev" | "cline"; taskId: string }
  | { type: "task:completed"; worker: "hermes" | "jev" | "cline"; taskId: string; result?: unknown }
  | { type: "task:failed"; worker: "hermes" | "jev" | "cline"; taskId: string; error: string }
  | { type: "log"; worker: "hermes" | "jev" | "cline"; message: string; level: "info" | "warn" | "error" };

type Listener = (event: WorkerEvent) => void;

class EventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: WorkerEvent) {
    this.listeners.forEach((l) => l(event));
  }
}

export const eventBus = new EventBus();
