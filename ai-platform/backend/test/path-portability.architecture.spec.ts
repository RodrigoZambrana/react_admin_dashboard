import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative } from 'node:path';

import { appPath } from './support/project-paths';

describe('Path portability architecture', () => {
  it('keeps absolute local filesystem paths out of runtime code and tests', () => {
    const roots = [
      appPath('backend', 'src'),
      appPath('backend', 'test'),
      appPath('frontend', 'src'),
    ];
    const offenders: string[] = [];

    for (const root of roots) {
      for (const file of walkFiles(root)) {
        if (!/\.(ts|tsx|js|jsx|json|md)$/u.test(file)) {
          continue;
        }

        const source = readFileSync(file, 'utf8');

        if (/\/Users\/|[A-Za-z]:\\Users\\/u.test(source)) {
          offenders.push(relative(appPath(), file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

function walkFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const file = appPath(relative(appPath(), root), entry);
    const stats = statSync(file);

    if (stats.isDirectory()) {
      files.push(...walkFiles(file));
      continue;
    }

    files.push(file);
  }

  return files;
}
