const DEFAULT_COUNTRY_CODE = "598";

const NON_DIGIT_EXCEPT_PLUS = /[^\d+]/g;
const NON_DIGIT = /\D/g;
const LEADING_ZEROS = /^0+/;

export const normalizePhoneNumber = (
  rawInput: string,
  countryCode: string = DEFAULT_COUNTRY_CODE
): string | null => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(NON_DIGIT_EXCEPT_PLUS, "");
  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(NON_DIGIT, "");
    return digits ? `+${digits}` : null;
  }

  const digitsOnly = cleaned.replace(NON_DIGIT, "");
  if (!digitsOnly) {
    return null;
  }

  if (digitsOnly.startsWith(countryCode)) {
    return `+${digitsOnly}`;
  }

  const withoutLeadingZeros = digitsOnly.replace(LEADING_ZEROS, "");
  if (!withoutLeadingZeros) {
    return null;
  }

  return `+${countryCode}${withoutLeadingZeros}`;
};

export const looksLikePhoneNumber = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("+")) {
    return /\+\d{6,}$/.test(trimmed.replace(/\s+/g, ""));
  }
  const digits = trimmed.replace(NON_DIGIT, "");
  return digits.length >= 6 && !trimmed.includes("@");
};
