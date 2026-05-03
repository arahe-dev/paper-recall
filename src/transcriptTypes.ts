export interface TranscriptCommand {
  id: string;
  shell: "powershell" | "bash" | "cmd" | "unknown";
  command: string;
  status: "pass" | "fail" | "unknown";
  evidence: string;
  line_start: number;
  line_end: number;
}

export interface TranscriptFileChange {
  path: string;
  action: "created" | "modified" | "deleted" | "unknown";
  evidence: string;
}

export interface TranscriptError {
  code: string;
  message: string;
  severity: "error";
  evidence: string;
  line: number;
}

export interface TranscriptWarning {
  message: string;
  severity: "warning";
  evidence: string;
  line: number;
}

export interface TranscriptVerification {
  name: string;
  status: "pass" | "fail" | "unknown";
  evidence: string;
}

export interface TranscriptCommit {
  hash: string;
  message: string;
  evidence: string;
}

export interface TranscriptSource {
  kind: "pasted_transcript";
  created_at: string;
  parser: string;
}

export interface TranscriptSummary {
  title: string;
  command_count: number;
  file_change_count: number;
  error_count: number;
  warning_count: number;
  verification_count: number;
  commit_count: number;
}

export interface TranscriptContext {
  schema: string;
  source: TranscriptSource;
  summary: TranscriptSummary;
  commands: TranscriptCommand[];
  files_changed: TranscriptFileChange[];
  errors: TranscriptError[];
  warnings: TranscriptWarning[];
  verification: TranscriptVerification[];
  commits: TranscriptCommit[];
  next_steps: string[];
  raw_excerpt: string;
}
