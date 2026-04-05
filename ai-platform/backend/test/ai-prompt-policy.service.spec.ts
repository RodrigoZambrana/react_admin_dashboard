import {
  DEFAULT_INTERPRETATION_POLICY_PROMPT,
} from '../src/modules/ai-gateway/ai-prompt-policy.defaults';
import { AiPromptContractService } from '../src/modules/ai-gateway/ai-prompt-contract.service';

describe('Core interpretation prompt policy', () => {
  it('keeps the core interpretation policy neutral and free of tenant-specific semantic overlay instructions', () => {
    expect(DEFAULT_INTERPRETATION_POLICY_PROMPT).not.toContain(
      'entities.price = "low"',
    );
    expect(DEFAULT_INTERPRETATION_POLICY_PROMPT).not.toContain(
      'entities.location = "kitchen"',
    );
    expect(DEFAULT_INTERPRETATION_POLICY_PROMPT).toContain(
      'Do not map tenant-specific commercial preferences or room taxonomies',
    );
  });

  it('keeps tenant-specific semantic overlay ownership out of the backend-owned interpretation contract', () => {
    const lines = new AiPromptContractService()
      .buildInterpretationContractLines()
      .join('\n');

    expect(lines).toContain(
      'Do not synthesize tenant-specific semantic overlays such as price bands, room taxonomies, or catalog-specific attributes',
    );
  });
});
