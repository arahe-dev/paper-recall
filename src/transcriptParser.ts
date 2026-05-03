import type {
  TranscriptCommand,
  TranscriptFileChange,
  TranscriptError,
  TranscriptWarning,
  TranscriptVerification,
  TranscriptCommit,
  TranscriptContext,
} from "./transcriptTypes";

function generateId(prefix: string, index: number) {
  return `${prefix}_${String(index + 1).padStart(3, "0")}`;
}

function detectShell(line: string): "powershell" | "bash" | "cmd" | "unknown" {
  if (line.startsWith("PS ") || line.includes(".ps1")) return "powershell";
  if (line.startsWith("$") || line.startsWith("> ")) return "bash";
  if (/^[A-Z]:\\/.test(line)) return "powershell";
  if (line.startsWith("cmd ") || line.startsWith("CMD ")) return "cmd";
  return "unknown";
}

function looksLikeCommand(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const common = [
    "npm ", "cargo ", "git ", "node ", "python ", "pytest ", "tsc ", "vite ",
    "cd ", "ls", "dir", "mkdir", "rm ", "cp ", "mv ", "cat ", "echo ",
    "powershell", "bash", "cmd ", "./", ".\\", "make", "docker", "rustc",
  ];
  return common.some((c) => trimmed.toLowerCase().startsWith(c.toLowerCase()));
}

export function parseTranscript(raw: string): TranscriptContext {
  const lines = raw.split("\n");
  const commands: TranscriptCommand[] = [];
  const filesChanged: TranscriptFileChange[] = [];
  const errors: TranscriptError[] = [];
  const warnings: TranscriptWarning[] = [];
  const verification: TranscriptVerification[] = [];
  const commits: TranscriptCommit[] = [];
  const nextSteps: string[] = [];

  let inFencedBlock = false;
  let blockLines: string[] = [];
  let blockStart = 0;

  let inNextSteps = false;

  const fileExtensions = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".rs",
    ".ps1", ".html", ".svg", ".toml", ".yaml", ".yml", ".py",
  ]);

  const pushBlock = () => {
    if (blockLines.length === 0) return;
    const blockText = blockLines.join("\n").trim();
    const shell = detectShell(blockLines[0]);
    if (looksLikeCommand(blockLines[0])) {
      let status: "pass" | "fail" | "unknown" = "unknown";
      const lower = blockText.toLowerCase();
      if (lower.includes("error") || lower.includes("failed") || lower.includes("fail")) {
        status = "fail";
      } else if (lower.includes("pass") || lower.includes("succeeded") || lower.includes("ok")) {
        status = "pass";
      }
      commands.push({
        id: generateId("cmd", commands.length),
        shell,
        command: blockLines[0].trim().replace(/^PS\s+/, "").replace(/^[A-Z]:\\.*?>/, "").replace(/^[$>]\s*/, ""),
        status,
        evidence: blockText,
        line_start: blockStart,
        line_end: blockStart + blockLines.length - 1,
      });
    }
    blockLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code blocks
    if (trimmed.startsWith("```")) {
      if (inFencedBlock) {
        pushBlock();
        inFencedBlock = false;
      } else {
        inFencedBlock = true;
        blockStart = i;
        blockLines = [];
      }
      continue;
    }

    if (inFencedBlock) {
      blockLines.push(line);
      continue;
    }

    // Next steps heuristic
    const lowerTrim = trimmed.toLowerCase();
    if (
      lowerTrim.includes("next steps") ||
      lowerTrim.includes("recommended next") ||
      lowerTrim.includes("remaining risks") ||
      lowerTrim.includes("known limitations") ||
      lowerTrim === "todo"
    ) {
      inNextSteps = true;
      continue;
    }
    if (inNextSteps) {
      if (trimmed.startsWith("#") || trimmed.startsWith("===") || trimmed.startsWith("---")) {
        inNextSteps = false;
      } else if (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) {
        nextSteps.push(trimmed.replace(/^[-*\d.\s]+/, ""));
        continue;
      } else if (trimmed) {
        nextSteps.push(trimmed);
        continue;
      }
    }

    // Inline commands
    if (looksLikeCommand(line)) {
      const shell = detectShell(line);
      let status: "pass" | "fail" | "unknown" = "unknown";
      const lower = line.toLowerCase();
      if (lower.includes("error") || lower.includes("failed") || lower.includes("fail")) {
        status = "fail";
      }
      commands.push({
        id: generateId("cmd", commands.length),
        shell,
        command: line.trim().replace(/^PS\s+/, "").replace(/^[A-Z]:\\.*?>/, "").replace(/^[$>]\s*/, ""),
        status,
        evidence: line.trim(),
        line_start: i,
        line_end: i,
      });
      continue;
    }

    // Errors
    if (
      /\berror\b/i.test(line) ||
      /\bfailed\b/i.test(line) ||
      /\bpanic\b/i.test(line) ||
      /\bcompile error\b/i.test(line) ||
      /\bTypeError\b/.test(line) ||
      /\bSyntaxError\b/.test(line) ||
      /\bTS\d{4,5}\b/.test(line) ||
      /\bERESOLVE\b/.test(line) ||
      /\bENOTEMPTY\b/.test(line) ||
      /\bEPERM\b/.test(line)
    ) {
      const codeMatch = line.match(/(TS\d{4,5}|ERESOLVE|ENOTEMPTY|EPERM|EACCES)/);
      errors.push({
        code: codeMatch ? codeMatch[1] : "UNKNOWN",
        message: trimmed,
        severity: "error",
        evidence: trimmed,
        line: i,
      });
      continue;
    }

    // Warnings
    if (
      /\bwarning\b/i.test(line) ||
      /\bdeprecated\b/i.test(line) ||
      /\bvulnerability\b/i.test(line) ||
      /\baudit\b/i.test(line) ||
      /npm warn/i.test(line)
    ) {
      warnings.push({
        message: trimmed,
        severity: "warning",
        evidence: trimmed,
        line: i,
      });
      continue;
    }

    // Commits
    const commitHashMatch = line.match(/(?:commit|Commit:)\s+([a-f0-9]{7,40})/i);
    if (commitHashMatch) {
      const hash = commitHashMatch[1];
      let message = "";
      const msgMatch = line.match(/["\u201C](.+?)["\u201D]/);
      if (msgMatch) {
        message = msgMatch[1];
      } else if (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next && !next.startsWith("commit") && !next.startsWith("Commit")) {
          message = next;
        }
      }
      commits.push({
        hash,
        message,
        evidence: trimmed,
      });
      continue;
    }

    // File changes
    const pathMatch = line.match(/([A-Za-z]:\\[^\s"]+|\.\/?[^\s"]+\.[a-z0-9]+)/i);
    if (pathMatch) {
      const ext = pathMatch[1].slice(pathMatch[1].lastIndexOf(".")).toLowerCase();
      if (fileExtensions.has(ext)) {
        let action: "created" | "modified" | "deleted" | "unknown" = "unknown";
        const prev = i > 0 ? lines[i - 1].toLowerCase() : "";
        if (prev.includes("created") || prev.includes("new")) action = "created";
        else if (prev.includes("modified") || prev.includes("updated")) action = "modified";
        else if (prev.includes("deleted") || prev.includes("removed")) action = "deleted";
        else if (lowerTrim.includes("create")) action = "created";
        else if (lowerTrim.includes("modify")) action = "modified";
        else if (lowerTrim.includes("delete")) action = "deleted";
        filesChanged.push({
          path: pathMatch[1],
          action,
          evidence: trimmed,
        });
        continue;
      }
    }

    // Verifications
    if (
      /npm run (build|dev|test)/i.test(line) ||
      /cargo (test|check|build)/i.test(line) ||
      /dev server started/i.test(line) ||
      /vite.*local/i.test(line) ||
      /build succeeded/i.test(line)
    ) {
      let status: "pass" | "fail" | "unknown" = "unknown";
      if (/error|fail/i.test(line)) status = "fail";
      else if (/succeeded|pass|started|ok/i.test(line)) status = "pass";
      verification.push({
        name: trimmed,
        status,
        evidence: trimmed,
      });
    }
  }

  // Deduplicate files by path
  const seenFiles = new Set<string>();
  const dedupedFiles = filesChanged.filter((f) => {
    if (seenFiles.has(f.path)) return false;
    seenFiles.add(f.path);
    return true;
  });

  const now = new Date().toISOString();

  return {
    schema: "recall-transcript-context-v0",
    source: {
      kind: "pasted_transcript",
      created_at: now,
      parser: "recall-transcript-parser-v0",
    },
    summary: {
      title: "Transcript Summary",
      command_count: commands.length,
      file_change_count: dedupedFiles.length,
      error_count: errors.length,
      warning_count: warnings.length,
      verification_count: verification.length,
      commit_count: commits.length,
    },
    commands,
    files_changed: dedupedFiles,
    errors,
    warnings,
    verification,
    commits,
    next_steps: nextSteps,
    raw_excerpt: raw.trim().slice(0, 1500),
  };
}
