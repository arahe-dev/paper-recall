import type { RecallGraphIR } from "../recallGraphIR";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function generateCalendar(year = new Date().getFullYear(), month = new Date().getMonth()): RecallGraphIR {
  const firstDay = new Date(year, month, 1);
  const monthName = firstDay.toLocaleString(undefined, { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstDay.getDay();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const nodes = Array.from({ length: cells }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    const row = Math.floor(index / 7);
    const column = index % 7;
    const isInMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    return {
      id: `day_${index + 1}`,
      label: isInMonth ? String(dayNumber) : " ",
      kind: WEEKDAYS[column].toLowerCase(),
      order: index + 1,
      layout_hint: `row:${row};column:${column}`,
    };
  });

  return {
    schema: "recall-graph-ir-v2",
    title: monthName,
    diagram_type: "calendar",
    layout: {
      style: "readable_matrix",
      strategy: "matrix",
      density: "compact",
    },
    nodes,
    edges: [],
  };
}

export const currentMonthCalendarTemplateIr = generateCalendar();
