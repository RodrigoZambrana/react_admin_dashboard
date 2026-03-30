import { buildControlledResponsePrompt } from '../prompts/analysis.prompt.js'

export const generateResponse = async ({
  provider,
  role,
  input,
  approvedDraft,
  approvedFacts = [],
  providerOptions = {},
  goal = null,
  mustAskQuestion = false,
  maxChars = 240,
  draftLabel = 'Borrador aprobado',
  channel = null,
  channelProfile = 'chat',
}) => {
  const draft = String(approvedDraft || '').replace(/\s+/g, ' ').trim()
  if (!draft) {
    return {
      text: '',
      source: 'empty_draft',
      applied: false,
    }
  }

  if (!provider?.generate) {
    return {
      text: draft,
      source: 'draft',
      applied: false,
    }
  }

  try {
    const generated = await provider.generate({
      role,
      systemPrompt: buildControlledResponsePrompt({
        goal,
        approvedFacts,
        mustAskQuestion,
        maxChars,
        channel,
        channelProfile,
      }),
      history: [],
      input: [
        `Consulta original: ${String(input || '').trim()}`,
        `${String(draftLabel || 'Borrador aprobado').trim()}: ${draft}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      tools: [],
      options: providerOptions,
    })
    const text = String(generated?.text || '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!text) {
      return {
        text: draft,
        source: 'draft',
        applied: false,
      }
    }

    return {
      text,
      source: 'llm_rewrite',
      applied: text !== draft,
    }
  } catch {
    return {
      text: draft,
      source: 'draft',
      applied: false,
    }
  }
}
