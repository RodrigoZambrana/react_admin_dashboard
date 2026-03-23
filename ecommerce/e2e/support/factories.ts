export type TestCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

export function buildTestCustomer(seed = Date.now()): TestCustomer {
  const suffix = `${seed}${randomDigits(4)}`;
  const phoneSuffix = suffix.slice(-7);

  return {
    firstName: "Playwright",
    lastName: `QA${suffix.slice(-4)}`,
    email: `playwright+${suffix}@example.com`,
    phone: `09${phoneSuffix}`,
    password: `Playwright@${suffix.slice(-6)}`
  };
}
