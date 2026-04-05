import {
  DEFAULT_INTERPRETATION_POLICY_PROMPT,
  DEFAULT_RESPONSE_POLICY_PROMPT,
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

  it('keeps the default response prompt grounded and closed to unsupported sales expansion', () => {
    expect(DEFAULT_RESPONSE_POLICY_PROMPT).toContain(
      'Do not open unsupported commercial axes such as price, purchase channel, where to buy, stock, exact colors, exact variants, or availability unless those details are explicitly approved in backend context.',
    );
    expect(DEFAULT_RESPONSE_POLICY_PROMPT).toContain(
      'For broad informational questions, stay focused on the approved product/advisory explanation instead of expanding into speculative sales options.',
    );
    expect(DEFAULT_RESPONSE_POLICY_PROMPT).toContain(
      'If the approved backend draft already answers the question, compress it instead of expanding it.',
    );
    expect(DEFAULT_RESPONSE_POLICY_PROMPT).toContain(
      'Do not answer with bare extracted lists, headings, operational checklists, or pasted documentation fragments.',
    );
    expect(DEFAULT_RESPONSE_POLICY_PROMPT).toContain(
      'When this is the first substantive reply in the conversation, begin with a brief cordial greeting before the answer.',
    );
    expect(DEFAULT_RESPONSE_POLICY_PROMPT).toContain(
      'Stay comfortably below the response length limit and always end with a complete sentence.',
    );
  });

  it('keeps the backend-owned response contract aligned with concise grounded runtime behavior', () => {
    const lines = new AiPromptContractService()
      .buildResponseContractLines()
      .join('\n');

    expect(lines).toContain(
      'Prefer plain prose over bullets for ordinary informational answers unless the backend-approved answer is explicitly list-shaped.',
    );
    expect(lines).toContain(
      'End the message with a complete sentence and do not trail off to fit length limits.',
    );
    expect(lines).toContain(
      'Do not return bare extracted lists, headings, operational checklists, or pasted documentation fragments as the final answer.',
    );
    expect(lines).toContain(
      'When the answer naturally has greeting, direct answer, and a next useful question, prefer short multi-paragraph formatting over one dense block.',
    );
  });
});
