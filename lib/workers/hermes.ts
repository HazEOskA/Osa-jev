import { eventBus, WorkerEvent } from "./eventBus";

type Task = {
  id: string;
  type: "research" | "code" | "orchestrate";
  payload: unknown;
};

class HermesOrchestrator {
  private queue: Task[] = [];
  private active: Task | null = null;

  enqueue(task: Task) {
    this.queue.push(task);
    eventBus.emit({ type: "task:queued", worker: "hermes", taskId: task.id });
    this.processQueue();
  }

  private async processQueue() {
    if (this.active || this.queue.length === 0) return;
    this.active = this.queue.shift()!;
    eventBus.emit({ type: "task:started", worker: "hermes", taskId: this.active.id });

    // Mock execution
    await new Promise((r) => setTimeout(r, 1000));
    eventBus.emit({ type: "task:completed", worker: "hermes", taskId: this.active.id });
    this.active = null;
    this.processQueue();
  }
}

export const hermes = new HermesOrchestrator();
