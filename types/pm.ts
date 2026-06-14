export type TaskStatus = "todo" | "in-progress" | "done" | "blocked" | "skipped";
export type PhaseStatus = "todo" | "in-progress" | "done" | "blocked";

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  notes?: string;
}

export interface Phase {
  id: string;
  name: string;
  status: PhaseStatus;
  target_date: string;
  tasks: Task[];
  notes?: string;
}

export interface Blocker {
  id: string;
  task_id: string;
  reason: string;
  since: string;
}

export interface Decision {
  id: string;
  date: string;
  description: string;
  reason: string;
}

export interface ProjectStatus {
  project: string;
  description: string;
  goal: string;
  updated: string;
  phases: Phase[];
  blockers?: Blocker[];
  decisions?: Decision[];
}
