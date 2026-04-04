import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Wave 4 response architecture guardrails', () => {
  const repoRoot = join(__dirname, '..');
  const touchedRuntimeFiles = [
    'src/modules/response/approved-response-context.service.ts',
    'src/modules/response/chat-response-policy.service.ts',
    'src/modules/response/chat-response.service.ts',
    'src/modules/response/response-guardrail.service.ts',
    'src/modules/response/response.types.ts',
    'src/modules/response-fallback/response-fallback.service.ts',
    'src/modules/api/chat-orchestrator.service.ts',
    'src/modules/ai-gateway/ai-gateway.service.ts',
    'src/modules/ai-gateway/providers/mock-language-model.provider.ts',
  ];
  const forbiddenPatterns = [
    /isSpanish\s*\(/,
    /startsWith\(\s*['"]es['"]\s*\)/,
    /locale\s*===\s*['"]es['"]/,
    /locale\s*===\s*['"]en['"]/,
    /language\s*===\s*['"]es['"]/,
    /language\s*===\s*['"]en['"]/,
  ];

  it('does not introduce new hardcoded locale branching in the touched live response services', () => {
    for (const relativePath of touchedRuntimeFiles) {
      const content = readFileSync(join(repoRoot, relativePath), 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
