## Mercado Pago Bricks · Next.js Demo

Pequeño proyecto pensado para pruebas locales de la integración con Mercado Pago Bricks (modo sandbox). Utiliza **Next.js 16 (App Router)**, no requiere base de datos y expone una única API interna para procesar pagos con tarjeta.

### Tecnologías Clave

- Next.js 16 + React 19 (App Router, TypeScript, Tailwind CSS).
- SDK oficial de Mercado Pago para Node.js (`mercadopago`).
- Payment Brick (Card Payment) montado dinámicamente desde el SDK web.

---

## Requisitos

- Node.js 18.17 o superior.
- Credenciales de prueba de Mercado Pago. Ya se incluyen en `.env.local`:

  ```txt
  NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-632ebe0d-6895-4755-b5f7-22a831e45d27
  # Opcional: habilita flows adicionales (transferencias, cuenta MP, etc.).
  NEXT_PUBLIC_MERCADO_PAGO_PREFERENCE_ID=TEST-PREFERENCE-ID
  MERCADO_PAGO_ACCESS_TOKEN=TEST-6249908203472499-102717-cf8020a9113d8f1574a5c8015683e0ba-670522668
  # Por defecto apunta a la API interna de Next.js. Cambia la URL si usas un backend externo.
  NEXT_PUBLIC_MERCADO_PAGO_PAYMENT_URL=/api/process-payment
  # Ruta interna a la que se redirige tras un pago exitoso.
  NEXT_PUBLIC_MERCADO_PAGO_SUCCESS_URL=/success
  ```

  > Si necesitas usar otras credenciales, reemplázalas en ese archivo.
  > Si apuntas a otro servidor, especifica la URL completa (por ejemplo `http://localhost:8080/process_payment`). El componente
  > también aceptará valores sin esquema cuando incluyan host y puerto (`localhost:8080/process_payment` se interpretará como
  > `http://localhost:8080/process_payment`).

---

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Levantar el entorno de desarrollo:

   ```bash
   npm run dev
   ```

3. Abrir [http://localhost:3000](http://localhost:3000) en el navegador. El Payment Brick se montará automáticamente y mostrará el resultado del pago en pantalla.

---

## Cómo funciona

- **Front-end (`src/components/MercadoPagoCardBrick.tsx`)**
  - Carga el SDK de Mercado Pago en tiempo de ejecución.
  - Renderiza el Payment Brick (`cardPayment`) con un monto fijo de ejemplo y soporta un `preferenceId` opcional
    para habilitar la Cuenta Mercado Pago, transferencias bancarias y otros medios fuera de tarjeta.
  - Maneja el estado del pago (cargando, éxito, error) y muestra la respuesta en la interfaz.
  - Notifica al Brick el resultado del backend usando las acciones expuestas (`submitComplete`, `resolve`, `reject`) para
    que el flujo del iframe continúe correctamente y puedas enganchar callbacks adicionales en la app host.
  - Habilita todas las categorías de pago disponibles en el Brick (tarjetas de crédito/débito, transferencias, tickets,
    billetera, consumer/onboarding credits, etc.).
- Carga automáticamente el script de seguridad de Mercado Pago (`https://www.mercadopago.com/v2/security.js`) para que la
  sesión genere los eventos de tracking (`/tracks`) requeridos por la plataforma.
- Envía los datos al endpoint definido en `NEXT_PUBLIC_MERCADO_PAGO_PAYMENT_URL` (por defecto `/api/process-payment`). El
  payload incluye tanto claves en `snake_case` como en `camelCase` para ser compatible con los ejemplos oficiales de Mercado
  Pago (`/process_payment`). Si indicas una URL absoluta, la solicitud irá directo a ese servidor; si usas una ruta relativa,
  el componente la normalizará automáticamente contra el origen actual. Para hosts con puerto sin esquema (`localhost:8080/...`)
  se asumirá `http://`.
- Una vez que el backend confirma el pago, el componente notifica al Brick y redirige a la ruta definida en
  `NEXT_PUBLIC_MERCADO_PAGO_SUCCESS_URL` (por defecto `/success`), pasando el ID y el estado del pago como parámetros para que
  puedas mostrar el resumen.

- **Back-end (`src/app/api/process-payment/route.ts`)**
  - Implementa un endpoint `POST /api/process-payment`.
  - Usa el SDK oficial (`mercadopago`) para crear un pago en modo test.
  - Acepta pagos con token (tarjetas) y sin token (transferencias, efectivo, billetera), normalizando los campos
    en `snake_case`/`camelCase`, propagando metadata adicional y limpiando la información del pagador antes de llamar al SDK.
  - Devuelve al cliente el `status`, `status_detail` e `id` del pago creado.

---

## Datos de prueba recomendados

- **Visa**: 4509 9535 6623 3704 · Vencimiento 11/30 · CVV 123
- **Mastercard**: 5031 7557 3453 0604 · Vencimiento 11/30 · CVV 123
- **Documento**: DNI 12345678 · Nombre libre

Para simular distintos estados de pago en modo sandbox, completa el nombre del titular con alguno de los códigos sugeridos por
Mercado Pago. El backend devolverá el `status` y el componente mostrará un mensaje acorde:

| Nombre del titular | Resultado esperado                               | Observaciones |
| ------------------ | ------------------------------------------------- | ------------- |
| `APRO`             | Pago aprobado                                    | Redirige a `/success` con el detalle del pago. |
| `OTHE`             | Rechazado por error general                       | Muestra la leyenda “Mercado Pago rechazó el pago por un error general…”. |
| `CONT`             | Pago pendiente/in_process                         | Deja el formulario visible e informa que el pago está en revisión. |
| `CALL`             | Rechazado con validación para autorizar           | Sugiere contactar al emisor antes de reintentar. |
| `FUND`             | Rechazado por fondos insuficientes                | Pide utilizar otro medio de pago. |
| `SECU`             | Rechazado por código de seguridad inválido        | Invita a revisar el CVV. |
| `EXPI`             | Rechazado por fecha de vencimiento inválida       | Solicita verificar la fecha de la tarjeta. |
| `FORM`             | Rechazado por error en el formulario              | Indica revisar los datos cargados. |

Mercado Pago provee más tarjetas de prueba en su [documentación oficial](https://www.mercadopago.com/developers/es/docs/checkout-pro/additional-content/test-cards).

---

## Siguientes pasos sugeridos

- Ajustar los montos e ítems según tu escenario.
- Agregar manejo de estado persistente o registro de pagos según necesidades.
- Integrar webhooks y notificaciones para completar el circuito de pago.
