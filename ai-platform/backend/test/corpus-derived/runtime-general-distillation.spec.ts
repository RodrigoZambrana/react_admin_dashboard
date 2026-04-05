import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backendPath, readAppFile } from '../support/project-paths';

describe('Runtime-general corpus distillation', () => {
  const fixtureDir = backendPath('test', 'fixtures', 'real-corpus', 'runtime-general');
  const fixtureFiles = readdirSync(fixtureDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
  const fixtures = fixtureFiles.map((file) =>
    JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as {
      id: string;
      promotionTarget: string;
      implementationScope: string;
      corePattern: string;
      nonPromotedLabels?: string[];
      expectedCoreBehavior?: string[];
    },
  );

  it('promotes only reusable runtime-general patterns into the core fixture set', () => {
    const allowedCorePatterns = new Set([
      'contextual_closure',
      'reengagement_after_gap',
      'operational_thread_switch',
      'system_message_interference',
      'loop_prevention',
    ]);

    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixture of fixtures) {
      expect(fixture.promotionTarget).toBe('core_platform');
      expect(fixture.implementationScope).toBe('runtime_general');
      expect(allowedCorePatterns.has(fixture.corePattern)).toBe(true);
      expect(fixture.expectedCoreBehavior?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps tenant capability labels explicit as non-core even when they appear inside reusable runtime fixtures', () => {
    const aggregatedNonPromotedLabels = new Set(
      fixtures.flatMap((fixture) => fixture.nonPromotedLabels ?? []),
    );

    expect(aggregatedNonPromotedLabels.has('quote_request')).toBe(true);
    expect(aggregatedNonPromotedLabels.has('structured_measurements')).toBe(true);
    expect(aggregatedNonPromotedLabels.has('appointment_scheduling')).toBe(true);
  });

  it('documents corpus distillation as regression input rather than runtime knowledge', () => {
    const report = readAppFile('docs', 'corpus-distillation-report.md');

    expect(report).toContain('The real corpus remains analysis and regression input only.');
    expect(report).toContain('approved tenant resources');
    expect(report).toContain('quote_request');
    expect(report).toContain('structured_measurements');
    expect(report).toContain('appointment_scheduling');
  });
});
