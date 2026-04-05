import { readBackendSource } from './support/project-paths';

describe('Routing signal architecture', () => {
  it('keeps lexical cue ownership out of decisive services', () => {
    const decisionSource = readBackendSource(
      'modules',
      'decision',
      'decision.service.ts',
    );
    const retrievalSource = readBackendSource(
      'modules',
      'documents',
      'document-retrieval.service.ts',
    );
    const continuitySource = readBackendSource(
      'modules',
      'continuity',
      'conversation-continuity.service.ts',
    );

    expect(decisionSource).toContain('ConversationSignalResolverService');
    expect(retrievalSource).toContain('ConversationSignalResolverService');
    expect(continuitySource).toContain('ConversationSignalResolverService');
    expect(decisionSource).not.toContain('advisoryCuePatterns');
    expect(retrievalSource).not.toContain('documentCuePatterns');
    expect(continuitySource).not.toContain('hasAdvisorySignals');
    expect(retrievalSource).not.toContain('const stopWords = new Set');
    expect(decisionSource).not.toContain('const stopWords = new Set');
  });
});
