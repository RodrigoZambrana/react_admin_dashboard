import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, "../..");

const require = createRequire(import.meta.url);
const { globSync } = require(path.join(repoRoot, "backend", "node_modules", "glob"));

export const hasGlobSyntax = (value) => /[*?{}\[\]]/.test(value);

export const normalizeToken = (value) => String(value ?? "").trim().replace(/^['"]|['"]$/g, "");

export const tokenizeCommandText = (text) =>
  String(text ?? "")
    .match(/[^\s"'`]+|"[^"]*"|'[^']*'/g)
    ?.map(normalizeToken)
    .filter(Boolean) ?? [];

export const extractTargetTokens = (command) => {
  const tokens = Array.isArray(command) ? command.flatMap((part) => tokenizeCommandText(part)) : tokenizeCommandText(command);
  return tokens.filter((token) => {
    if (!token) return false;
    if (token.startsWith("--")) return false;
    if (token === "&&" || token === "||" || token === ";") return false;
    if (/\.(spec|test)\.(ts|tsx|js|mjs)$/i.test(token)) return true;
    if (hasGlobSyntax(token) && /\.(spec|test)\.(ts|tsx|js|mjs)$/i.test(token)) return true;
    if (token.includes("/") && /\.(spec|test)\.(ts|tsx|js|mjs)$/i.test(token)) return true;
    return false;
  });
};

export const inspectPathToken = (cwd, pattern) => {
  const baseDir = path.resolve(repoRoot, cwd);
  const normalizedPattern = normalizeToken(pattern);
  if (!normalizedPattern) {
    return {
      kind: "empty",
      normalizedPattern,
      matches: [],
    };
  }

  if (hasGlobSyntax(normalizedPattern)) {
    return {
      kind: "glob",
      normalizedPattern,
      matches: globSync(normalizedPattern, { cwd: baseDir, nodir: true, absolute: true, dot: false }),
    };
  }

  const absolutePath = path.resolve(baseDir, normalizedPattern);
  if (!fs.existsSync(absolutePath)) {
    return {
      kind: "missing",
      normalizedPattern,
      matches: [],
    };
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return {
      kind: stats.isDirectory() ? "directory" : "non-file",
      normalizedPattern,
      matches: [],
    };
  }

  return {
    kind: "file",
    normalizedPattern,
    matches: [absolutePath],
  };
};

export const resolveMatches = (cwd, pattern) => inspectPathToken(cwd, pattern).matches;

export const skipMarkerPattern = /\b(?:test|it|describe)\.skip\s*\(/;

export const fileContainsSkipMarker = (filePath) => {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  try {
    return skipMarkerPattern.test(fs.readFileSync(filePath, "utf8"));
  } catch {
    return false;
  }
};

export const filesContainSkipMarker = (files) =>
  uniqueFiles(files).filter((filePath) => fileContainsSkipMarker(filePath));

function uniqueFiles(files) {
  return Array.from(new Set((files ?? []).filter(Boolean)));
}

export const testArtifactPattern = /(?:^|\/)(?:__tests__\/.*|.*\.(?:spec|test)\.(?:ts|tsx|js|mjs))$/i;
export const governanceArtifactPattern = /^docs\/testing\/(?:governance-rules|runtime-integrity-report|workbook-validation-report)\.md$/i;

export const isTestArtifactPath = (value) => testArtifactPattern.test(String(value ?? "").replace(/\\/g, "/"));

export const isGovernanceArtifactPath = (value) =>
  governanceArtifactPattern.test(String(value ?? "").replace(/\\/g, "/"));

export const isPathLikeEvidence = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !/^https?:\/\//i.test(value) &&
  !/^docs\/qa\/runtime/i.test(value);

export const splitEvidenceTokens = (value) =>
  String(value ?? "")
    .split(/[;\n,]/)
    .map(normalizeToken)
    .filter(Boolean);
