export const CUSTOMER_RUNTIME_CLOSURE_RESIDUAL_MINI_SET = {
  sourceRunId: 'closure-corpus-2026-04-01T05-21-41-183Z',
  sourceReportPath:
    '.qa/runs/closure-corpus-2026-04-01T05-21-41-183Z.closure-corpus.json',
  lowNaturalitySemanticTurnIds: [
    '00000005-chat-de-whatsapp-con-andrea-mendaro:semantic-turn-4',
    '00000006-chat-de-whatsapp-con-valeria-godoy:semantic-turn-9',
    '00000008-chat-de-whatsapp-con-karina:semantic-turn-16',
    '00000011-chat-de-whatsapp-con-598-98-135-819:semantic-turn-3',
    '00000020-chat-de-whatsapp-con-598-99-874-430:semantic-turn-7',
    '00000027-chat-de-whatsapp-con-lucia-cig:semantic-turn-3',
    '00000027-chat-de-whatsapp-con-lucia-cig:semantic-turn-4',
    '00000027-chat-de-whatsapp-con-lucia-cig:semantic-turn-8',
    '00000027-chat-de-whatsapp-con-lucia-cig:semantic-turn-21',
    '00000027-chat-de-whatsapp-con-lucia-cig:semantic-turn-25',
  ],
  representativeCases: {
    quoteAvailabilitySideQuestion: {
      semanticTurnId: '00000027-chat-de-whatsapp-con-lucia-cig:semantic-turn-8',
      branch: 'answer_side_question',
      userText: 'Muchas gracias! Que demora tienen?',
      expectedResidual: 'quote-side availability should not reopen quote intake',
    },
    quoteReadyClosure: {
      semanticTurnId: '00000006-chat-de-whatsapp-con-valeria-godoy:semantic-turn-9',
      branch: 'quote_ready',
      userText: 'Ok. Muchas gracias por responder . Voy a evaluarlo.',
      expectedResidual: 'ready quote handoff should not be rewritten as fresh quote progression',
    },
    scheduleCourtesyClosure: {
      semanticTurnId: '00000020-chat-de-whatsapp-con-598-99-874-430:semantic-turn-7',
      branch: 'hold_for_more_context',
      userText: 'Muchas gracias. Saludos',
      expectedResidual: 'schedule courtesy closure should stay contextual and avoid empty repeats',
    },
  },
}
