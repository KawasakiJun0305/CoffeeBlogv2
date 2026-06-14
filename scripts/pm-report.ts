import status from "../pm/status";
import type { Phase, Task, Blocker } from "../types/pm";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
};

function statusBadge(s: string): string {
  switch (s) {
    case "done":        return `${C.green}✓ done${C.reset}`;
    case "in-progress": return `${C.cyan}→ in-progress${C.reset}`;
    case "blocked":     return `${C.red}✗ blocked${C.reset}`;
    case "skipped":     return `${C.gray}– skipped${C.reset}`;
    default:            return `${C.dim}○ todo${C.reset}`;
  }
}

function phaseHeader(phase: Phase, today: Date): string {
  const target = new Date(phase.target_date);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  const dateStr = phase.status === "done"
    ? `${C.gray}(完了)${C.reset}`
    : diff < 0
      ? `${C.red}(${Math.abs(diff)}日超過)${C.reset}`
      : `${C.yellow}(残${diff}日)${C.reset}`;
  return `${C.bold}${C.white}[${phase.id.toUpperCase()}] ${phase.name}${C.reset} ${statusBadge(phase.status)} ${dateStr}`;
}

function taskLine(task: Task): string {
  const indent = "  ";
  return `${indent}${statusBadge(task.status).padEnd(20)} ${task.id.padEnd(6)} ${task.name}${task.notes ? C.gray + "  // " + task.notes + C.reset : ""}`;
}

function printReport(): void {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  console.log();
  console.log(`${C.bold}${C.cyan}━━━ ${status.project} ━━━${C.reset}`);
  console.log(`${C.dim}${status.description}${C.reset}`);
  console.log(`${C.dim}更新: ${status.updated} / レポート: ${todayStr}${C.reset}`);
  console.log();

  // フェーズサマリー
  const total = status.phases.length;
  const done = status.phases.filter((p) => p.status === "done").length;
  const inProgress = status.phases.filter((p) => p.status === "in-progress").length;
  console.log(`${C.bold}進捗: ${done}/${total} フェーズ完了${inProgress > 0 ? ` (${inProgress} 進行中)` : ""}${C.reset}`);
  console.log();

  // フェーズ詳細
  for (const phase of status.phases) {
    console.log(phaseHeader(phase, today));
    if (phase.notes) {
      console.log(`  ${C.gray}📋 ${phase.notes}${C.reset}`);
    }
    for (const task of phase.tasks) {
      console.log(taskLine(task));
    }

    // タスクサマリー
    const taskDone = phase.tasks.filter((t) => t.status === "done").length;
    const taskTotal = phase.tasks.length;
    console.log(`  ${C.gray}${taskDone}/${taskTotal} タスク完了${C.reset}`);
    console.log();
  }

  // ブロッカー
  if (status.blockers && status.blockers.length > 0) {
    console.log(`${C.bold}${C.red}🚫 ブロッカー${C.reset}`);
    for (const b of status.blockers) {
      console.log(`  [${b.id}] ${b.task_id}: ${b.reason} ${C.gray}(${b.since}以降)${C.reset}`);
    }
    console.log();
  }

  // 意思決定ログ
  if (status.decisions && status.decisions.length > 0) {
    console.log(`${C.bold}💡 意思決定ログ${C.reset}`);
    for (const d of status.decisions) {
      console.log(`  ${C.gray}[${d.date}]${C.reset} ${d.description}`);
      console.log(`    ${C.dim}理由: ${d.reason}${C.reset}`);
    }
    console.log();
  }

  // 次のアクション（最初の todo フェーズの最初の todo タスク）
  const nextPhase = status.phases.find((p) => p.status !== "done");
  if (nextPhase) {
    const nextTask = nextPhase.tasks.find((t) => t.status === "todo");
    if (nextTask) {
      console.log(`${C.bold}▶ 次のアクション${C.reset}`);
      console.log(`  ${nextPhase.name} / ${nextTask.name}`);
      console.log(`  タスクID: ${C.cyan}${nextTask.id}${C.reset}`);
      console.log();
    }
  }

  console.log(`${C.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log();
}

printReport();
