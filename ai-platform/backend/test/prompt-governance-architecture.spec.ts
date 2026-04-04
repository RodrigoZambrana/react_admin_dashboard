import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Wave 8.3 prompt governance architecture', () => {
  const repoRoot = join(__dirname, '..');
  const interpretationPrompt = readFileSync(
    join(repoRoot, 'src/resources/prompts/interpretation.txt'),
    'utf8',
  );
  const responsePrompt = readFileSync(
    join(repoRoot, 'src/resources/prompts/response.txt'),
    'utf8',
  );
  const assemblySource = readFileSync(
    join(repoRoot, 'src/modules/ai-gateway/ai-prompt-assembly.service.ts'),
    'utf8',
  );

  it('keeps structural response/interpretation contracts out of governed prompt resources', () => {
    expect(interpretationPrompt).not.toMatch(/Required keys:\s*intent/i);
    expect(interpretationPrompt).not.toMatch(/Allowed intents:/i);
    expect(responsePrompt).not.toMatch(/assertedExecutionStatus/i);
    expect(responsePrompt).not.toMatch(/mentionedApprovedResultKeys/i);
  });

  it('assembles governed policy and backend-owned contract through separate boundaries', () => {
    expect(assemblySource).toContain(
      'private readonly promptPolicyService: AiPromptPolicyService',
    );
    expect(assemblySource).toContain(
      'private readonly promptContractService: AiPromptContractService',
    );
  });
});
