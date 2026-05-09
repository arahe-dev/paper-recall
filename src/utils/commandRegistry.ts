export interface AppCommand {
  id: string;
  title: string;
  description?: string;
  shortcut?: string;
  group?: string;
  run: () => void | Promise<void>;
}

export function filterCommands(commands: AppCommand[], query: string): AppCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands;
  return commands.filter((command) => (
    command.title.toLowerCase().includes(normalized) ||
    command.description?.toLowerCase().includes(normalized) ||
    command.group?.toLowerCase().includes(normalized)
  ));
}
