const sourceLeadPatterns = [
  /^(seg[uú]n el (?:documento|cat[aá]logo),?\s*)/iu,
  /^(el (?:documento|cat[aá]logo)\s+(?:indica|menciona|dice|señala)\s+que\s+)/iu,
  /^(the (?:document|catalog)\s+(?:says|indicates|mentions|states)\s+that\s+)/iu,
] as const;

const companyVoicePattern =
  /^([A-ZÁÉÍÓÚÜÑ][\p{L}\d&'.-]*(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ][\p{L}\d&'.-]*){0,4})\s+(ofrece|cuenta con|dispone de|tiene|realiza|trabaja con)\b/iu;

const blockedSubjectPattern =
  /^(esta|este|estas|estos|esa|ese|esas|esos|la|el|las|los|this|these|that|those)\b/iu;

export function normalizeSourceObliviousSummary(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  const withoutSourceLead = stripSourceLead(normalized);
  const companyVoiceRewritten = rewriteLeadingCompanyVoice(withoutSourceLead);

  return companyVoiceRewritten.replace(/^./u, (character) => character.toUpperCase());
}

function stripSourceLead(value: string) {
  return sourceLeadPatterns.reduce(
    (current, pattern) => current.replace(pattern, ''),
    value,
  );
}

function rewriteLeadingCompanyVoice(value: string) {
  return value.replace(
    companyVoicePattern,
    (match, subject: string, verb: string) => {
      if (blockedSubjectPattern.test(subject)) {
        return match;
      }

      const normalizedVerb = verb.toLowerCase();

      if (
        normalizedVerb === 'ofrece' ||
        normalizedVerb === 'cuenta con' ||
        normalizedVerb === 'dispone de' ||
        normalizedVerb === 'tiene'
      ) {
        return 'Tenemos';
      }

      if (normalizedVerb === 'realiza') {
        return 'Realizamos';
      }

      return 'Trabajamos con';
    },
  );
}
