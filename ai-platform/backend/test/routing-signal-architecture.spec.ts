import { readFileSync } from 'node:fs';

describe('Routing signal architecture', () => {
  it('keeps lexical cue ownership out of decisive services', () => {
    const decisionSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/decision/decision.service.ts',
      'utf8',
    );
    const retrievalSource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/documents/document-retrieval.service.ts',
      'utf8',
    );
    const continuitySource = readFileSync(
      '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/continuity/conversation-continuity.service.ts',
      'utf8',
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
