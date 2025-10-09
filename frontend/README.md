# elstar-ts

## Configuración de Google reCAPTCHA

Para habilitar la validación de reCAPTCHA en el formulario de inicio de sesión es
necesario añadir la clave de sitio generada en la consola de Google reCAPTCHA.

1. Crea un archivo `.env` en la carpeta `frontend` si aún no existe.
2. Define la variable `VITE_RECAPTCHA_SITE_KEY` con el valor de tu clave de sitio (por ejemplo, `6LejMNQrAAAAALMJpL_nnU3fH3Kxtr8fvW2tWaqS`):

   ```bash
   VITE_RECAPTCHA_SITE_KEY=6LejMNQrAAAAALMJpL_nnU3fH3Kxtr8fvW2tWaqS
   ```

Sin esta configuración se mostrará un aviso en la pantalla de inicio de sesión solicitando la clave correspondiente.
