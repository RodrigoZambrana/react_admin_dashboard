import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const DEFAULT_REAL_CORPUS_MANIFESTS_DIR = path.join(
  REPO_ROOT,
  ".qa",
  "external-real-conversations",
  "whatsapp",
  "manifests"
);
export const DEFAULT_REAL_CORPUS_RUNS_DIR = path.join(REPO_ROOT, ".qa", "runs");
export const LATEST_REAL_CORPUS_REPLAY_POINTER = path.join(
  DEFAULT_REAL_CORPUS_RUNS_DIR,
  "latest-real-corpus-replay.json"
);

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function resolveReplayRunDir(runDir = null) {
  if (runDir) {
    return path.resolve(runDir);
  }

  const latest = await readJson(LATEST_REAL_CORPUS_REPLAY_POINTER);
  if (!latest?.runDir) {
    throw new Error(`latest_replay_run_missing:${LATEST_REAL_CORPUS_REPLAY_POINTER}`);
  }

  return path.resolve(latest.runDir);
}

export function cleanMessageText(value) {
  return String(value || "")
    .replace(/\u200e|\u200f|\ufeff/g, "")
    .replace(/\s*<Se editó este mensaje\.>\s*/gu, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function shouldKeepCorpusTranscriptTurn(turn) {
  if (!turn || turn.authorRole === "system") {
    return false;
  }

  const text = cleanMessageText(turn.text);
  if (!text) {
    return false;
  }

  if (text === "<Multimedia omitido>") {
    return false;
  }

  if (text === "Se eliminó este mensaje.") {
    return false;
  }

  return true;
}

export function mergeSpeakerTurns(
  turns,
  {
    getSpeaker = (turn) => turn?.speaker ?? null,
    getText = (turn) => cleanMessageText(turn?.text ?? "")
  } = {}
) {
  const merged = [];

  for (const turn of Array.isArray(turns) ? turns : []) {
    const speaker = getSpeaker(turn);
    if (!speaker) {
      continue;
    }

    const text = getText(turn);
    if (!text) {
      continue;
    }

    const previous = merged.at(-1);
    if (previous && previous.speaker === speaker) {
      previous.messages.push(text);
      continue;
    }

    merged.push({
      speaker,
      messages: [text]
    });
  }

  return merged;
}

export function renderConversationText(
  conversationId,
  mergedTurns,
  { includeHeader = true } = {}
) {
  const blocks = includeHeader ? [conversationId] : [];

  for (const turn of mergedTurns) {
    blocks.push(`${turn.speaker}: ${turn.messages.join("\n")}`);
  }

  return `${blocks.join("\n\n")}\n`;
}

export function buildCorpusTranscriptConversation(
  manifest,
  { customerLabel = "Cliente", agentLabel = "Agente" } = {}
) {
  const rawTurns = Array.isArray(manifest?.turns)
    ? manifest.turns.filter(shouldKeepCorpusTranscriptTurn)
    : [];

  const mergedTurns = mergeSpeakerTurns(rawTurns, {
    getSpeaker: (turn) => {
      if (turn.authorRole === "customer") {
        return customerLabel;
      }
      if (turn.authorRole === "business") {
        return agentLabel;
      }
      return null;
    },
    getText: (turn) => cleanMessageText(turn.text)
  });

  return {
    conversationId: manifest?.conversationId || "unknown-conversation",
    mergedTurns,
    rawTurnCount: rawTurns.length
  };
}

export function getReplayTurnResponseText(turn, fallbackLabel = "Chat") {
  const base =
    turn?.responseText ||
    turn?.response?.finalUserText ||
    turn?.response?.text ||
    (turn?.error?.message ? `[error ${fallbackLabel.toLowerCase()}] ${turn.error.message}` : "");

  return cleanMessageText(base);
}

export function buildReplayTranscriptConversation(
  conversation,
  { customerLabel = "Cliente", agentLabel = "Chat" } = {}
) {
  const rawTurns = [];

  for (const turn of Array.isArray(conversation?.turns) ? conversation.turns : []) {
    const userText = cleanMessageText(turn?.user?.text || "");
    if (userText) {
      rawTurns.push({
        speaker: customerLabel,
        text: userText
      });
    }

    const responseText = getReplayTurnResponseText(turn, agentLabel);
    if (responseText) {
      rawTurns.push({
        speaker: agentLabel,
        text: responseText
      });
    }
  }

  const mergedTurns = mergeSpeakerTurns(rawTurns);

  return {
    conversationId: conversation?.conversationId || "unknown-conversation",
    mergedTurns,
    rawTurnCount: rawTurns.length
  };
}

export async function writeTranscriptFiles(
  conversations,
  { outputDir, combinedFileName }
) {
  const perConversationDir = path.join(outputDir, "by-conversation");
  await mkdir(outputDir, { recursive: true });
  await mkdir(perConversationDir, { recursive: true });

  const combinedSections = [];
  const stats = {
    totalConversations: 0,
    exportedConversationFiles: 0,
    conversationsWithContent: 0,
    conversationsWithoutContent: 0,
    sourceTurns: 0,
    renderedBlocks: 0
  };

  for (const conversation of conversations) {
    const conversationId = conversation.conversationId;
    const mergedTurns = Array.isArray(conversation.mergedTurns) ? conversation.mergedTurns : [];
    const rendered = renderConversationText(conversationId, mergedTurns);
    const perConversationRendered = renderConversationText(conversationId, mergedTurns, {
      includeHeader: false
    });

    stats.totalConversations += 1;
    stats.sourceTurns += Number(conversation.rawTurnCount || 0);
    stats.renderedBlocks += mergedTurns.length;

    if (mergedTurns.length > 0) {
      stats.conversationsWithContent += 1;
    } else {
      stats.conversationsWithoutContent += 1;
    }

    combinedSections.push(rendered.trimEnd());
    await writeFile(
      path.join(perConversationDir, `${conversationId}.txt`),
      perConversationRendered,
      "utf8"
    );
    stats.exportedConversationFiles += 1;
  }

  const combinedPath = path.join(outputDir, combinedFileName);
  await writeFile(
    combinedPath,
    `${combinedSections.join("\n\n" + "-".repeat(80) + "\n\n")}\n`,
    "utf8"
  );

  return {
    combinedPath,
    perConversationDir,
    stats
  };
}
