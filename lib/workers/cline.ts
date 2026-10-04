import { eventBus } from "./eventBus";

type Patch = { path: string; diff: string };

class ClineWorker {
  async code(task: string): Promise<Patch[]> {
    const taskId = crypto.randomUUID();
    eventBus.emit({ type: "task:started", worker: "cline", taskId });
    eventBus.emit({ type: "log", worker: "cline", message: `Coding: ${task.slice(0, 50)}...`, level: "info" });

    // Mock coding
    await new Promise((r) => setTimeout(r, 1200));
    const patches: Patch[] = [];
    eventBus.emit({ type: "task:completed", worker: "cline", taskId, result: patches });
    return patches;
  }
}

export const cline = new ClineWorker();
