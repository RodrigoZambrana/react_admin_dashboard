import { readFileSync } from 'node:fs';

describe('AI gateway architecture', () => {
  it('keeps provider resolution and prompt protocol assembly outside AiGatewayService', () => {
    const gatewaySource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/ai-gateway/ai-gateway.service.ts',
      'utf8',
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
