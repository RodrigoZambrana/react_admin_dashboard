import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDirectory, '..');
const sourceDirectory = resolve(backendRoot, 'src/resources');
const targetDirectory = resolve(backendRoot, 'dist/resources');

if (existsSync(sourceDirectory)) {
  mkdirSync(targetDirectory, { recursive: true });
  cpSync(sourceDirectory, targetDirectory, { recursive: true });
}
