# Time Machine Config Recovery

Source reviewed:
- `/Volumes/Time Machine/2026-04-20-120649.previous/Data/Users/rodrigo/Git/personal/react_admin_dashboard`

## Recovered and Persisted

- `email.provider.config`
- `inbox.email.config`
- `payments.mercadopago`
- `integrations.google` reCAPTCHA block

## Recovered in Repo Files, Not from Time Machine

- `RECAPTCHA_SECRET_KEY`
- `ADMIN_RECAPTCHA_SITE_KEY`
- `STOREFRONT_RECAPTCHA_SITE_KEY`
- `VITE_RECAPTCHA_SITE_KEY`
- GA4 / Ads OAuth bootstrap values from `backend/.env.analytics.local`

## Present in Time Machine but Still Missing or Empty

- Storefront Google auth client credentials:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- Google analytics / growth stored config:
  - `GOOGLE_ANALYTICS_MEASUREMENT_ID`
  - `GOOGLE_TAG_MANAGER_CONTAINER_ID`
  - `GOOGLE_ADS_CONVERSION_ID`
  - `GOOGLE_ADS_CONVERSION_LABEL`
  - `GOOGLE_SEARCH_CONSOLE_VERIFICATION_TOKEN`
- Meta growth / ads config:
  - `META_PIXEL_ID`
  - `META_CONVERSIONS_API_TOKEN`
  - `META_ADS_ACCOUNT_ID`
  - `CONTENT_INSIGHTS_ENABLED`
- Mercado Pago backend credential:
  - `MP_ACCESS_TOKEN`

## Notes

- The current local test stack is now configured to read the recovered email, inbox, Mercado Pago public key, and reCAPTCHA values from secure config.
- Google storefront auth remains disabled because the Time Machine backup did not contain storefront OAuth client credentials.
- Analytics OAuth and Ads bootstrap values were found in `backend/.env.analytics.local`, but that slice remains env-backed and is not stored in the existing secure-config contract.
