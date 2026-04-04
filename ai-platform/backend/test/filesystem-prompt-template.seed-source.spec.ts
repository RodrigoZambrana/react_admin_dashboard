import { FileSystemPromptTemplateSeedSource } from '../src/modules/prompt/filesystem-prompt-template.seed-source';

describe('FileSystemPromptTemplateSeedSource', () => {
  it('loads prompt seeds from backend-managed resources', async () => {
    const seedSource = new FileSystemPromptTemplateSeedSource();

    await expect(seedSource.listSeeds()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'interpretation',
          value: expect.stringContaining(
            'Classify the latest user turn conservatively',
          ),
        }),
        expect.objectContaining({
          key: 'response',
          value: expect.stringContaining(
            'Rewrite the approved backend draft into a clear final user-facing answer.',
          ),
        }),
      ]),
    );
  });
});
