export const isLocalTestRecaptchaBypassEnabled = (): boolean =>
  process.env.LOCAL_TEST_ENV === 'true'
