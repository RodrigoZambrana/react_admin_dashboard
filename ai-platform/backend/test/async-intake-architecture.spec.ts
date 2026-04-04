import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Wave 8.1 async intake architecture guardrails', () => {
  const repoRoot = join(__dirname, '..');
  const asyncIntakeSource = readFileSync(
    join(repoRoot, 'src/modules/api/async-turn-intake.service.ts'),
    'utf8',
  );
  const chatOrchestratorSource = readFileSync(
    join(repoRoot, 'src/modules/api/chat-orchestrator.service.ts'),
    'utf8',
  );

  it('keeps async intake on the semantic-turn boundary instead of depending on AI/provider internals directly', () => {
    expect(asyncIntakeSource).toContain(
      'private readonly semanticTurnExecutionService: SemanticTurnExecutionService',
    );
    expect(asyncIntakeSource).toContain(
      'this.semanticTurnExecutionService.executeClosedTurn',
    );
    expect(asyncIntakeSource).not.toContain('AiGatewayService');
    expect(asyncIntakeSource).not.toContain('LanguageModelProviderRegistry');
    expect(asyncIntakeSource).not.toContain('AiPromptAssemblyService');
    expect(asyncIntakeSource).not.toContain('InterpretationService');
    expect(asyncIntakeSource).not.toContain('DecisionService');
    expect(asyncIntakeSource).not.toContain('ToolExecutionService');
    expect(asyncIntakeSource).not.toContain('ChatResponseService');
    expect(asyncIntakeSource).not.toMatch(/\bopenai\b/i);
    expect(asyncIntakeSource).not.toMatch(/\bmock\b/i);
  });

  it('shares the same semantic-turn execution boundary as the synchronous chat path', () => {
    expect(chatOrchestratorSource).toContain(
      'private readonly semanticTurnExecutionService: SemanticTurnExecutionService',
    );
    expect(chatOrchestratorSource).toContain(
      'this.semanticTurnExecutionService.executeClosedTurn',
    );
  });
});
