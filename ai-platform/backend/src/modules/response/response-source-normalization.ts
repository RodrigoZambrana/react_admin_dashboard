export function normalizeSourceObliviousSummary(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  const withoutSourceLead = normalized
    .replace(/^(seg[uú]n el (?:documento|cat[aá]logo),?\s*)/iu, '')
    .replace(
      /^(el (?:documento|cat[aá]logo)\s+(?:indica|menciona|dice|señala)\s+que\s+)/iu,
      '',
    )
    .replace(
      /^(the (?:document|catalog)\s+(?:says|indicates|mentions|states)\s+that\s+)/iu,
      '',
    );

  const companyVoiceRewritten = withoutSourceLead.replace(
    /^([A-ZÁÉÍÓÚÜÑ][\p{L}\d&'.-]*(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ][\p{L}\d&'.-]*){0,4})\s+(ofrece|cuenta con|dispone de|tiene|realiza|trabaja con)\b/iu,
    (match, company: string, verb: string) => {
      if (
        /^(esta|este|estas|estos|esa|ese|esas|esos|la|el|las|los|this|these|that|those)\b/iu.test(
          company,
        )
      ) {
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

  return companyVoiceRewritten.replace(/^./u, (character) => character.toUpperCase());
}
