import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Wave 3 continuity architecture guardrails', () => {
  const repoRoot = join(__dirname, '..');
  const touchedRuntimeFiles = [
    'src/modules/continuity/conversation-continuity.service.ts',
    'src/modules/continuity/continuity.types.ts',
    'src/modules/decision/decision.service.ts',
    'src/modules/api/chat-orchestrator.service.ts',
    'src/modules/tools/create-quote.tool.ts',
    'src/modules/tools/get-product.tool.ts',
  ];
  const forbiddenPatterns = [
    /isSpanish\s*\(/,
    /startsWith\(\s*['"]es['"]\s*\)/,
    /locale\s*===\s*['"]es['"]/,
    /locale\s*===\s*['"]en['"]/,
    /language\s*===\s*['"]es['"]/,
    /language\s*===\s*['"]en['"]/,
  ];

  it('does not introduce new hardcoded locale branching in the touched continuity path', () => {
    for (const relativePath of touchedRuntimeFiles) {
      const content = readFileSync(join(repoRoot, relativePath), 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
