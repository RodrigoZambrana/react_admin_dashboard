import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Runtime-managed resource repositories', () => {
  const repoRoot = join(
    __dirname,
    '../src/modules/persistence/repositories',
  );

  it('make tenant scope explicit for governed runtime resources instead of relying on cross-tenant ambiguity', () => {
    const files = [
      'prompt-version.repository.ts',
      'critical-config-version.repository.ts',
      'knowledge-metadata-version.repository.ts',
      'response-fallback-version.repository.ts',
      'temporal-locale-version.repository.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), 'utf8');

      expect(source).toContain('const tenantId = this.tenantContext.getTenantId();');
      expect(source).toContain('tenantId');
    }
  });
});
