import { readBackendSource } from './support/project-paths';

describe('AI gateway architecture', () => {
  it('keeps provider resolution and prompt protocol assembly outside AiGatewayService', () => {
    const gatewaySource = readBackendSource(
      'modules',
      'ai-gateway',
      'ai-gateway.service.ts',
    );

    expect(gatewaySource).toContain('this.providerRegistry.resolve');
    expect(gatewaySource).toContain(
      'this.promptAssemblyService.buildInterpretationRequest',
    );
    expect(gatewaySource).toContain(
      'this.promptAssemblyService.buildResponseRequest',
    );

    expect(gatewaySource).not.toMatch(/providerConfig\.provider\s*===/);
    expect(gatewaySource).not.toContain('Return JSON only.');
    expect(gatewaySource).not.toContain('approved deterministic fallback draft');
    expect(gatewaySource).not.toContain('assertedExecutionStatus');
    expect(gatewaySource).not.toContain('buildInterpretationPrompt');
    expect(gatewaySource).not.toContain('buildResponsePrompt');
  });
});
