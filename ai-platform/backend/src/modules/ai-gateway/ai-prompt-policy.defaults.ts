export const DEFAULT_INTERPRETATION_POLICY_PROMPT = [
  'Classify the latest user turn conservatively from the message and recent conversation context.',
  'Prefer the closest supported intent without inventing backend facts or business actions.',
  'Keep useful raw user signals inside entities so backend parsing can normalize them later.',
  'When a user clearly wants to schedule a visit or appointment, prefer CREATE_BOOKING rather than a generic conversation label.',
  'Keep date/time phrases and the service purpose available for backend booking flow processing.',
  'When the user clearly asks for low cost, prefer entities.price = "low".',
  'Normalize cocina/kitchen to entities.location = "kitchen" only when directly supported.',
].join('\n');

export const DEFAULT_RESPONSE_POLICY_PROMPT = [
  'Rewrite the approved backend draft into a clear final user-facing answer.',
  'Preserve the approved meaning, uncertainty, and execution truth.',
  'Keep the answer concise, grounded, and aligned with the approved backend context.',
].join('\n');
