#!/usr/bin/env node

import { cp } from "node:fs/promises";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "../../src/common");
const targetDir = path.resolve(__dirname, "../.shared/common");

async function syncSharedCommon() {
  try {
    await rm(targetDir, { recursive: true, force: true });
    await cp(sourceDir, targetDir, { recursive: true });
  } catch (err) {
    console.error("Failed to sync shared common modules:", err);
    process.exit(1);
  }
}

await syncSharedCommon();
