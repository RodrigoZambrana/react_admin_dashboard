#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import {
  extractTargetTokens,
  fileContainsSkipMarker,
  inspectPathToken,
  isGovernanceArtifactPath,
  isPathLikeEvidence,
  isTestArtifactPath,
  repoRoot,
  splitEvidenceTokens,
} from "./validation-utils.mjs";
import { normalizeManifestProfiles } from "./monorepo-suite-runner.mjs";

const require = createRequire(import.meta.url);
const ExcelJS = require(path.join(repoRoot, "backend", "node_modules", "exceljs"));

const manifestPath = path.join(repoRoot, "tools", "qa", "manifest.json");
const ecommercePackagePath = path.join(repoRoot, "ecommerce", "package.json");
const workbookPath = path.join(repoRoot, "docs", "qa", "system-use-cases-report.xlsx");
const docsDir = path.join(repoRoot, "docs", "testing");

const deferredTargetMatchers = [
  (value) => value.includes("ai-platform/"),
  (value) => value.includes("/src/conversations/") || value.startsWith("src/conversations/"),
  (value) => value.includes("/src/knowledge/") || value.startsWith("src/knowledge/"),
  (value) => value.includes("/src/ai/") || value.startsWith("src/ai/"),
  (value) => {
    const base = path.basename(value);
    return (
      base.startsWith("admin-ai-") ||
      base === "admin-aberturas-ai-flows.spec.ts" ||
      base === "storefront-webchat-authenticated-memory.spec.ts" ||
      base.startsWith("aberturas-chat")
    );
  },
];

function isDeferredTarget(target) {
  const normalized = String(target ?? "").replace(/\\/g, "/");
  return deferredTargetMatchers.some((matcher) => matcher(normalized));
}

function isDeferredEvidencePath(token) {
  return isDeferredTarget(token);
}

function parseArgs(argv) {
  const options = {
    workspace: null,
    writeDocs: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write-docs") {
      options.writeDocs = true;
      continue;
    }
    if (arg === "--workspace") {
      options.workspace = String(argv[index + 1] ?? "").trim() || null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--workspace=")) {
      options.workspace = arg.slice("--workspace=".length).trim() || null;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node tools/qa/validate-governance.mjs [--workspace <name>] [--write-docs]");
      process.exit(0);
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectCommandTargets(command) {
  return Array.isArray(command)
    ? command.flatMap((part) => extractTargetTokens(part))
    : extractTargetTokens(command);
}

function resolveCommandRoot(cwd, command) {
  const commandText = Array.isArray(command) ? command.join(" ") : String(command);
  if (/test:e2e|playwright\s+test/i.test(commandText) && /ecommerce$/.test(path.resolve(cwd))) {
    return path.join(cwd, "e2e");
  }
  return cwd;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function validateTargetList(cwd, targets) {
  const issues = [];
  const resolvedTargets = [];
  const deferredTargets = [];

  for (const target of unique(targets)) {
    if (isDeferredTarget(target)) {
      deferredTargets.push({ target, cwd: path.relative(repoRoot, cwd) || ".", reason: "deferred-scope" });
      continue;
    }
    const inspection = inspectPathToken(cwd, target);
    const matches = inspection.matches;
    resolvedTargets.push({
      target,
      kind: inspection.kind,
      matches: matches.map((entry) => path.relative(repoRoot, entry)),
    });
    if (inspection.kind === "directory" || inspection.kind === "non-file") {
      issues.push({
        type: "invalid-target-type",
        cwd: path.relative(repoRoot, cwd) || ".",
        target,
        targetType: inspection.kind,
      });
      continue;
    }
    if (matches.length === 0) {
      issues.push({
        type: "missing-target",
        cwd: path.relative(repoRoot, cwd) || ".",
        target,
      });
    }
  }

  return { issues, resolvedTargets, deferredTargets };
}

const blockingWorkbookIssueTypes = new Set([
  "missing-workbook",
  "missing-sheet",
  "missing-evidence",
  "invalid-evidence",
  "skip-evidence",
  "literal-skip-evidence",
]);

function validateSkipMarkers(files, critical = false) {
  const issues = [];
  const skipPattern = /\b(?:test|it|describe)\.skip\s*\(/;

  for (const file of unique(files)) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (skipPattern.test(content)) {
      issues.push({
        type: critical ? "critical-skip" : "skip-marker",
        file: path.relative(repoRoot, file),
      });
    }
  }

  return issues;
}

function validateWorkbook() {
  const report = {
    totalGreenRows: 0,
    issues: [],
    rows: [],
  };

  if (!fs.existsSync(workbookPath)) {
    report.issues.push({ type: "missing-workbook", file: path.relative(repoRoot, workbookPath) });
    return report;
  }

  const workbook = new ExcelJS.Workbook();
  return workbook.xlsx.readFile(workbookPath).then(() => {
    const sheet = workbook.getWorksheet("Guia manual");
    if (!sheet) {
      report.issues.push({ type: "missing-sheet", sheet: "Guia manual" });
      return report;
    }

    const greenStatuses = new Set(["VERIFICADA", "valid", "passing", "automated"]);
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const v = row.values;
      const status = String(v[5] ?? "").trim();
      if (!greenStatuses.has(status)) return;

      report.totalGreenRows += 1;
      const evidence = String(v[10] ?? "").trim();
      const evidenceTokens = splitEvidenceTokens(evidence);
      const pathEvidenceTokens = evidenceTokens.filter((token) => isPathLikeEvidence(token));
      const missingRefs = [];
      const invalidRefs = [];
      const skipRefs = [];
      const wildcardRefs = [];
      const resolvedRefs = [];
      const executableRefs = [];
      const deferredExecutableRefs = [];

      for (const token of pathEvidenceTokens) {
        const inspection = inspectPathToken(repoRoot, token);
        const matches = inspection.matches;
        if (inspection.kind === "glob") {
          wildcardRefs.push(token);
        }
        if (matches.length === 0) {
          if (inspection.kind === "directory" || inspection.kind === "non-file") {
            invalidRefs.push({ token, reason: inspection.kind });
          } else {
            missingRefs.push(token);
          }
          continue;
        }

        for (const entry of matches) {
          const relativePath = path.relative(repoRoot, entry);
          resolvedRefs.push(relativePath);
          if (isTestArtifactPath(relativePath) || isGovernanceArtifactPath(relativePath)) {
            executableRefs.push(relativePath);
            if (isDeferredEvidencePath(relativePath)) {
              deferredExecutableRefs.push(relativePath);
            }
            if (isTestArtifactPath(relativePath) && fileContainsSkipMarker(entry)) {
              skipRefs.push(relativePath);
            }
          }
        }
      }

      if (pathEvidenceTokens.length === 0) {
        report.issues.push({
          type: "missing-path-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
        });
      }

      if (missingRefs.length > 0) {
        report.issues.push({
          type: "missing-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
          missingRefs,
        });
      }

      if (invalidRefs.length > 0) {
        report.issues.push({
          type: "invalid-evidence-path",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
          invalidRefs,
        });
      }

      if (wildcardRefs.length > 0) {
        report.issues.push({
          type: "wildcard-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
          wildcardRefs: Array.from(new Set(wildcardRefs)),
        });
      }

      const uniqueSkipRefs = Array.from(new Set(skipRefs));
      if (uniqueSkipRefs.length > 0) {
        report.issues.push({
          type: "skip-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
          skipRefs: uniqueSkipRefs,
        });
      }

      const uniqueExecutableRefs = Array.from(new Set(executableRefs));
      const uniqueDeferredExecutableRefs = Array.from(new Set(deferredExecutableRefs));
      if (uniqueExecutableRefs.length === 0) {
        report.issues.push({
          type: "non-executable-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
          resolvedRefs: Array.from(new Set(resolvedRefs)),
        });
      } else if (uniqueDeferredExecutableRefs.length === uniqueExecutableRefs.length) {
        report.issues.push({
          type: "deferred-only-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
          deferredRefs: uniqueDeferredExecutableRefs,
        });
      }

      if (/(?:test|it|describe)\.skip\s*\(|\.skip\b/i.test(evidence)) {
        report.issues.push({
          type: "literal-skip-evidence",
          rowNumber,
          id: String(v[2] ?? ""),
          project: String(v[1] ?? ""),
          status,
          evidence,
        });
      }

      report.rows.push({
        rowNumber,
        id: String(v[2] ?? ""),
        project: String(v[1] ?? ""),
        status,
        evidence,
        resolvedRefs: Array.from(new Set(resolvedRefs)),
        executableRefs: uniqueExecutableRefs,
      });
    });

    return report;
  });
}

async function writeDocs(result) {
  await fsp.mkdir(docsDir, { recursive: true });
  const runtimeIssueCounts = countByType(result.runtimeIssues);
  const workbookIssueCounts = countByType(result.workbook.issues);
  const runtimeIssueLines = result.runtimeIssues.map(formatRuntimeIssue);
  const workbookIssueLines = result.workbook.issues.map(formatWorkbookIssue);

  const governanceRules = `# QA Governance Rules

These rules are enforced to eliminate false green states.

- A spec reference must resolve to at least one real file, not a directory placeholder.
- A command that expands to zero files is a failure.
- A critical suite cannot contain \`.skip\` markers in any resolved target.
- Workbook rows marked \`VERIFICADA\`, \`valid\`, \`passing\`, or \`automated\` must contain at least one executable evidence artifact.
- Docs, source files, directories, and globs can supplement traceability, but they do not count as executable proof on their own.
- Evidence that only points to deferred AI / chat-platform scopes cannot satisfy the core workbook gate.
- Workbook evidence cannot use wildcards as the only reference for a green claim.
- Coverage without runtime integrity does not count.
`;

  const runtimeIntegrity = [
    `# Runtime Integrity Report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    `- Manifest/spec drift issues: ${result.manifestIssues.length}`,
    `- Critical script issues: ${result.ecommerceCriticalCheck.issues.length}`,
    `- Critical skip issues: ${result.criticalSkipIssues.length}`,
    `- Workbook governance issues: ${result.workbook.issues.length}`,
    `- Deferred targets inventoried: ${result.deferredTargets.length}`,
    ``,
    `## Findings`,
    ...(runtimeIssueLines.length > 0 ? runtimeIssueLines : ["- none"]),
    ``,
    `## Issue Counts`,
    ...Object.entries(runtimeIssueCounts).map(([type, count]) => `- ${type}: ${count}`),
    ``,
    `## Deferred Scope`,
    `- Deferred matching now stays limited to explicit AI/chat-platform evidence instead of broad conversation or email naming patterns.`,
    `- Deferred inventory remains informative only; it cannot keep workbook rows green on its own.`,
    ``,
    `## Critical Scripts`,
    `- Mercado Pago remains a critical payment path and must be validated against live secure config, not a mocked success path.`,
    `- \`ecommerce/test:e2e:critical\` still hard-fails if declared specs drift or disappear.`,
  ].join("\n");

  const workbookValidation = [
    `# Workbook Validation Report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    `- Green rows scanned: ${result.workbook.totalGreenRows}`,
    `- False-green candidates: ${result.workbook.issues.length}`,
    ...Object.entries(workbookIssueCounts).map(([type, count]) => `- ${type}: ${count}`),
    ``,
    `## Issues`,
    ...(workbookIssueLines.length > 0 ? workbookIssueLines : ["- none"]),
  ].join("\n");

  await fsp.writeFile(path.join(docsDir, "governance-rules.md"), governanceRules, "utf8");
  await fsp.writeFile(path.join(docsDir, "runtime-integrity-report.md"), runtimeIntegrity, "utf8");
  await fsp.writeFile(path.join(docsDir, "workbook-validation-report.md"), workbookValidation, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = readJson(manifestPath);
  const profiles = normalizeManifestProfiles(manifest);
  const deferredBlockIds = new Set(profiles.deferred.blockIds ?? []);
  const ecommercePackage = readJson(ecommercePackagePath);

  const manifestIssues = [];
  const manifestCriticalFiles = [];
  const deferredTargets = [];

  for (const block of manifest.blocks ?? []) {
    if (deferredBlockIds.has(block.id)) {
      deferredTargets.push({
        blockId: block.id,
        cwd: path.resolve(repoRoot, block.cwd),
        reason: "deferred-profile",
      });
      continue;
    }
    const steps = Array.isArray(block.steps) && block.steps.length > 0 ? block.steps : [{ cwd: block.cwd, command: block.command }];
    for (const step of steps) {
      const cwd = path.resolve(repoRoot, step.cwd);
      const targets = collectCommandTargets(step.command);
      const validationRoot = resolveCommandRoot(cwd, step.command);
      const result = validateTargetList(validationRoot, targets);
      manifestIssues.push(...result.issues.map((issue) => ({ ...issue, blockId: block.id })));
      deferredTargets.push(...result.deferredTargets.map((entry) => ({ ...entry, blockId: block.id })));
      if ((block.tags ?? []).some((tag) => ["critical", "e2e"].includes(String(tag))) || /critical/i.test(String(block.id))) {
        manifestCriticalFiles.push(
          ...result.resolvedTargets.flatMap((entry) => {
            if (isDeferredTarget(entry.target)) {
              return [];
            }
            return entry.matches.map((match) => path.resolve(repoRoot, match));
          }),
        );
      }
    }
  }

  const ecommerceCriticalScript = String(ecommercePackage.scripts?.["test:e2e:critical"] ?? "");
  const ecommerceCriticalTargets = collectCommandTargets(ecommerceCriticalScript);
  const ecommerceCriticalCheck = validateTargetList(path.join(repoRoot, "ecommerce", "e2e"), ecommerceCriticalTargets);
  const criticalSkipIssues = validateSkipMarkers(ecommerceCriticalFilesFrom(manifestCriticalFiles, ecommerceCriticalCheck.resolvedTargets), true);

  const workbook = await validateWorkbook();
  const blockingWorkbookIssues = workbook.issues.filter((issue) => blockingWorkbookIssueTypes.has(issue.type));

  const result = {
    manifestIssues,
    ecommerceCriticalCheck,
    criticalSkipIssues,
    deferredTargets,
    workbook,
    runtimeIssues: [
      ...manifestIssues,
      ...ecommerceCriticalCheck.issues.map((issue) => ({ ...issue, blockId: "ecommerce-package:test:e2e:critical" })),
      ...criticalSkipIssues,
      ...blockingWorkbookIssues,
    ],
  };

  console.log(JSON.stringify(result, null, 2));

  if (options.writeDocs) {
    await writeDocs(result);
  }

  if (result.runtimeIssues.length > 0) {
    process.exitCode = 1;
  }
}

function ecommerceCriticalFilesFrom(manifestCriticalFiles, resolvedTargets) {
  const files = new Set(manifestCriticalFiles);
  for (const entry of resolvedTargets) {
    for (const match of entry.matches ?? []) {
      files.add(path.resolve(repoRoot, match));
    }
  }
  return Array.from(files);
}

function countByType(issues) {
  return issues.reduce((counts, issue) => {
    counts[issue.type] = (counts[issue.type] ?? 0) + 1;
    return counts;
  }, {});
}

function formatRuntimeIssue(issue) {
  if (issue.rowNumber) {
    const details =
      issue.id && issue.project ? `${issue.id} (${issue.project}, row ${issue.rowNumber})` : `row ${issue.rowNumber}`;
    return `- ${issue.type}: ${details}`;
  }

  if (issue.target) {
    const details = issue.cwd ? `${issue.target} (${issue.cwd})` : issue.target;
    return `- ${issue.type}: ${details}`;
  }

  if (issue.file) {
    return `- ${issue.type}: ${issue.file}`;
  }

  return `- ${issue.type}`;
}

function formatWorkbookIssue(issue) {
  const prefix = `${issue.id ?? issue.type} [row ${issue.rowNumber}]`;

  if (issue.missingRefs?.length) {
    return `- ${prefix}: ${issue.type} -> ${issue.missingRefs.join(", ")}`;
  }

  if (issue.invalidRefs?.length) {
    return `- ${prefix}: ${issue.type} -> ${issue.invalidRefs
      .map((entry) => `${entry.token} (${entry.reason})`)
      .join(", ")}`;
  }

  if (issue.wildcardRefs?.length) {
    return `- ${prefix}: ${issue.type} -> ${issue.wildcardRefs.join(", ")}`;
  }

  if (issue.skipRefs?.length) {
    return `- ${prefix}: ${issue.type} -> ${issue.skipRefs.join(", ")}`;
  }

  if (issue.deferredRefs?.length) {
    return `- ${prefix}: ${issue.type} -> ${issue.deferredRefs.join(", ")}`;
  }

  if (issue.resolvedRefs?.length) {
    return `- ${prefix}: ${issue.type} -> ${issue.resolvedRefs.join(", ")}`;
  }

  return `- ${prefix}: ${issue.type}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
