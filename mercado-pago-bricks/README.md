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
  MERCADO_PAGO_ACCESS_TOKEN=TEST-6249908203472499-102717-cf8020a9113d8f1574a5c8015683e0ba-670522668
  # Por defecto apunta a la API interna de Next.js. Cambia la URL si usas un backend externo.
  NEXT_PUBLIC_MERCADO_PAGO_PAYMENT_URL=/api/process-payment
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
  - Renderiza el Payment Brick (`cardPayment`) con un monto fijo de ejemplo.
  - Maneja el estado del pago (cargando, éxito, error) y muestra la respuesta en la interfaz.
  - Notifica al Brick el resultado del backend usando las acciones expuestas (`submitComplete`, `resolve`, `reject`) para
    que el flujo del iframe continúe correctamente y puedas enganchar callbacks adicionales en la app host.
- Carga automáticamente el script de seguridad de Mercado Pago (`https://www.mercadopago.com/v2/security.js`) para que la
  sesión genere los eventos de tracking (`/tracks`) requeridos por la plataforma.
- Envía los datos al endpoint definido en `NEXT_PUBLIC_MERCADO_PAGO_PAYMENT_URL` (por defecto `/api/process-payment`). El
  payload incluye tanto claves en `snake_case` como en `camelCase` para ser compatible con los ejemplos oficiales de Mercado
  Pago (`/process_payment`). Si indicas una URL absoluta, la solicitud irá directo a ese servidor; si usas una ruta relativa,
  el componente la normalizará automáticamente contra el origen actual. Para hosts con puerto sin esquema (`localhost:8080/...`)
  se asumirá `http://`.

- **Back-end (`src/app/api/process-payment/route.ts`)**
  - Implementa un endpoint `POST /api/process-payment`.
  - Usa el SDK oficial (`mercadopago`) para crear un pago en modo test.
  - Devuelve al cliente el `status`, `status_detail` e `id` del pago creado.

---

## Datos de prueba recomendados

- **Visa**: 4509 9535 6623 3704 · Vencimiento 11/30 · CVV 123  
- **Mastercard**: 5031 7557 3453 0604 · Vencimiento 11/30 · CVV 123  
- **Documento**: DNI 12345678 · Nombre libre

Mercado Pago provee más tarjetas de prueba en su [documentación oficial](https://www.mercadopago.com/developers/es/docs/checkout-pro/additional-content/test-cards).

---

## Siguientes pasos sugeridos

- Ajustar los montos e ítems según tu escenario.
- Agregar manejo de estado persistente o registro de pagos según necesidades.
- Integrar webhooks y notificaciones para completar el circuito de pago.
