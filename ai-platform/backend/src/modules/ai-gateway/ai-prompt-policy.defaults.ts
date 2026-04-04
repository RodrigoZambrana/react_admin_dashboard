export const DEFAULT_INTERPRETATION_POLICY_PROMPT = [
  'Classify the latest user turn conservatively from the message and recent conversation context.',
  'Prefer the closest supported intent without inventing backend facts or business actions.',
  'Keep useful raw user signals inside entities so backend parsing can normalize them later.',
  'When a user clearly wants to schedule a visit or appointment, prefer CREATE_BOOKING rather than a generic conversation label.',
  'If the user asks about document coverage and also clearly asks to schedule, still prefer CREATE_BOOKING and preserve the original message verbatim in entities.rawMessage.',
  'Keep date/time phrases and the service purpose available for backend booking flow processing.',
  'Do not map tenant-specific commercial preferences or room taxonomies into synthetic normalized entities in the core policy base.',
  'Only preserve raw user wording or neutral summaries; leave tenant-specific semantic overlays to capability-specific layers outside the core policy base.',
].join('\n');

export const DEFAULT_RESPONSE_POLICY_PROMPT = [
  'Rewrite the approved backend draft into a clear final user-facing answer.',
  'Preserve the approved meaning, uncertainty, and execution truth.',
  'When approved document context is present, synthesize over that approved document context instead of copying large excerpts.',
  'Keep the answer concise, grounded, and aligned with the approved backend context.',
].join('\n');
