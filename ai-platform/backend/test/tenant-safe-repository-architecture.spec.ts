import { readBackendSource } from './support/project-paths';

describe('tenant-safe repository architecture', () => {
  it('keeps tenant-scoped async turn writes on updateMany plus scoped reads', () => {
    const source = readBackendSource(
      'modules',
      'persistence',
      'repositories',
      'async-conversation-turn.repository.ts',
    );

    expect(source).toContain('asyncConversationTurn.updateMany(');
    expect(source).not.toContain('asyncConversationTurn.update(');
    expect(source).not.toContain('asyncConversationTurn.findUniqueOrThrow(');
  });

  it('keeps conversation state updates on updateMany rather than unique update', () => {
    const source = readBackendSource(
      'modules',
      'persistence',
      'repositories',
      'conversation-state.repository.ts',
    );

    expect(source).toContain('conversationState.updateMany(');
    expect(source).not.toContain('conversationState.update(');
  });

  it('keeps knowledge embedding updates on updateMany rather than unique update', () => {
    const source = readBackendSource(
      'modules',
      'persistence',
      'repositories',
      'knowledge.repository.ts',
    );

    expect(source).toContain('knowledge.updateMany(');
    expect(source).not.toContain('knowledge.update(');
  });

  it('keeps document lifecycle updates on updateMany plus scoped reads', () => {
    const source = readBackendSource(
      'modules',
      'persistence',
      'repositories',
      'document.repository.ts',
    );

    expect(source).toContain('documentRecord.updateMany(');
    expect(source).not.toContain('documentRecord.update(');
  });

  it('replaces document chunks through tenant-scoped deleteMany/createMany operations', () => {
    const source = readBackendSource(
      'modules',
      'persistence',
      'repositories',
      'document-chunk.repository.ts',
    );

    expect(source).toContain('documentChunk.deleteMany(');
    expect(source).toContain('documentChunk.createMany(');
    expect(source).not.toContain('documentChunk.update(');
  });

  it('keeps tenant-derived extraction hints scoped to document-backed upserts and scoped reads', () => {
    const source = readBackendSource(
      'modules',
      'persistence',
      'repositories',
      'document-extraction-profile-config.repository.ts',
    );

    expect(source).toContain('documentExtractionProfileConfigRecord.upsert(');
    expect(source).toContain('listActiveByProfilesAndLocale');
    expect(source).toContain('listByDocumentAndProfiles');
    expect(source).toContain("sourceKind: 'TENANT_DERIVED'");
  });
});
