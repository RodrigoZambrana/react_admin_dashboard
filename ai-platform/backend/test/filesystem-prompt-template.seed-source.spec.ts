import { FileSystemPromptTemplateSeedSource } from '../src/modules/prompt/filesystem-prompt-template.seed-source';

describe('FileSystemPromptTemplateSeedSource', () => {
  it('loads prompt seeds from backend-managed resources', async () => {
    const seedSource = new FileSystemPromptTemplateSeedSource();

    await expect(seedSource.listSeeds()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'interpretation',
          value: expect.stringContaining('You are the interpretation layer'),
        }),
        expect.objectContaining({
          key: 'response',
          value: expect.stringContaining('You are the response generation layer'),
        }),
      ]),
    );
  });
});
