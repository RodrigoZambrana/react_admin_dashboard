import { readFileSync } from 'node:fs';

const asyncTurnRepositoryPath =
  '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/persistence/repositories/async-conversation-turn.repository.ts';
const conversationStateRepositoryPath =
  '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/persistence/repositories/conversation-state.repository.ts';
const knowledgeRepositoryPath =
  '/Users/rodrigo/git/personal/react_admin_dashboard/ai-platform/backend/src/modules/persistence/repositories/knowledge.repository.ts';

describe('tenant-safe repository architecture', () => {
  it('keeps tenant-scoped async turn writes on updateMany plus scoped reads', () => {
    const source = readFileSync(asyncTurnRepositoryPath, 'utf8');

    expect(source).toContain('asyncConversationTurn.updateMany(');
    expect(source).not.toContain('asyncConversationTurn.update(');
    expect(source).not.toContain('asyncConversationTurn.findUniqueOrThrow(');
  });

  it('keeps conversation state updates on updateMany rather than unique update', () => {
    const source = readFileSync(conversationStateRepositoryPath, 'utf8');

    expect(source).toContain('conversationState.updateMany(');
    expect(source).not.toContain('conversationState.update(');
  });

  it('keeps knowledge embedding updates on updateMany rather than unique update', () => {
    const source = readFileSync(knowledgeRepositoryPath, 'utf8');

    expect(source).toContain('knowledge.updateMany(');
    expect(source).not.toContain('knowledge.update(');
  });
});
