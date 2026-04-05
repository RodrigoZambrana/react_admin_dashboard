import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(__dirname, '..', '..', '..');

export function appPath(...segments: string[]) {
  return resolve(appRoot, ...segments);
}

export function backendPath(...segments: string[]) {
  return appPath('backend', ...segments);
}

export function frontendPath(...segments: string[]) {
  return appPath('frontend', ...segments);
}

export function readBackendSource(...segments: string[]) {
  return readFileSync(backendPath('src', ...segments), 'utf8');
}

export function readBackendTestFile(...segments: string[]) {
  return readFileSync(backendPath('test', ...segments), 'utf8');
}

export function readFrontendSource(...segments: string[]) {
  return readFileSync(frontendPath('src', ...segments), 'utf8');
}

export function readAppFile(...segments: string[]) {
  return readFileSync(appPath(...segments), 'utf8');
}
