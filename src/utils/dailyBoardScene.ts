import { renderRecallGraphIR } from "../recallGraphRenderer";
import type { RecallGraphIR } from "../recallGraphIR";
import type { SceneData } from "./boardStorage";
import { formatDisplayDateFromKey, getLocalTimezone } from "./localDate";

const COLUMNS = ["Now", "Next", "Later", "Waiting"] as const;
const ROWS = ["Focus", "Admin", "People", "Review"] as const;

function createDailyGraph(dateKey: string): RecallGraphIR {
  const nodes = ROWS.flatMap((row, rowIndex) => (
    COLUMNS.map((column, columnIndex) => ({
      id: `${row.toLowerCase()}_${column.toLowerCase()}`,
      label: column,
      body: `${row}: `,
      order: rowIndex * COLUMNS.length + columnIndex + 1,
      layout_hint: `row:${rowIndex};column:${columnIndex}`,
    }))
  ));

  return {
    schema: "recall-graph-ir-v2",
    title: `Daily - ${dateKey}`,
    diagram_type: "comparison",
    layout: {
      style: "readable_matrix",
      strategy: "matrix",
      density: "readable",
    },
    nodes,
    edges: [],
    annotations: [
      {
        id: "daily_capture_inbox",
        kind: "daily_section",
        order: 1,
        text: "Capture Inbox\n- ",
      },
      {
        id: "daily_schedule_strip",
        kind: "daily_section",
        order: 2,
        text: "Schedule Strip\nMorning: \nMidday: \nAfternoon: \nEvening: ",
      },
      {
        id: "daily_shutdown_review",
        kind: "daily_section",
        order: 3,
        text: "Shutdown Review\nDone: \nCarry Forward: \nBlocked: ",
      },
    ],
    metadata: {
      recall: {
        version: 1,
        kind: "daily",
        daily: {
          dateKey,
          timezone: getLocalTimezone(),
          templateId: "daily-time-matrix-v1",
          createdAt: Date.now(),
        },
      },
    },
  };
}

export function createDailyBoardScene(dateKey: string): SceneData {
  const graph = createDailyGraph(dateKey);
  const result = renderRecallGraphIR(graph);
  if (!result.valid) {
    throw new Error(result.errors.join("; "));
  }

  return {
    elements: result.elements as unknown[],
    appState: {
      viewBackgroundColor: "#fbfbf7",
      gridSize: 20,
    },
    files: {},
  };
}

export function createDailyBoardName(dateKey: string): string {
  return `Daily - ${dateKey}`;
}

export function createDailyBoardSubtitle(dateKey: string): string {
  return `${formatDisplayDateFromKey(dateKey)} - ${getLocalTimezone()}`;
}
