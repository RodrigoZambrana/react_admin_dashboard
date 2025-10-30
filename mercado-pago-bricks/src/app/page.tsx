"use client";

import { useState } from "react";

import MercadoPagoCardBrick from "@/components/MercadoPagoCardBrick";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);

export default function Home() {
  const productPriceUyu = 1990;
  const [payerEmail, setPayerEmail] = useState("test_user_123456@example.com");

  return (
    <main className="min-h-screen bg-slate-100 py-12 font-sans text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 lg:flex-row">
        <section className="flex w-full flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm lg:w-2/5">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
              Next.js + Mercado Pago Bricks
            </p>
            <h1 className="text-3xl font-semibold leading-tight">
              Demo de pago con tarjeta usando Payment Brick
            </h1>
            <p className="text-sm text-slate-500">
              Este proyecto está listo para que pruebes integraciones con Mercado Pago Bricks en
              modo sandbox. Usa las tarjetas de prueba y completa los campos solicitados por el
              componente al momento del pago.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-base font-semibold text-slate-800">Producto de ejemplo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Auriculares inalámbricos · Modelo XZ-90
            </p>
            <p className="mt-4 text-3xl font-bold text-blue-600">
              {formatCurrency(productPriceUyu, "UYU")}
            </p>
            <p className="text-xs text-slate-400">Monto expresado en pesos uruguayos · Modo prueba</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Tarjetas de prueba sugeridas</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>Visa: 4509 9535 6623 3704 · Venc: 11/30 · CVV 123</li>
              <li>Mastercard: 5031 7557 3453 0604 · Venc: 11/30 · CVV 123</li>
              <li>Doc: DNI 12345678 · Nombre a elección</li>
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Siempre confirmar el resultado en el panel de respuesta del componente.
            </p>
          </div>
        </section>

        <section className="flex w-full flex-1 flex-col gap-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 space-y-2">
              <h2 className="text-xl font-semibold text-slate-800">Completa el pago</h2>
              <p className="text-sm text-slate-500">
                El Payment Brick se monta a continuación y utiliza la API interna{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">
                  /api/process-payment
                </code>{" "}
                para enviar los datos de la tarjeta de manera segura.
              </p>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label
                className="block text-sm font-semibold text-slate-800"
                htmlFor="payer-email"
              >
                Email del comprador
              </label>
              <input
                id="payer-email"
                type="email"
                value={payerEmail}
                onChange={(event) => setPayerEmail(event.target.value)}
                placeholder="ejemplo@gmail.com"
                required
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Mercado Pago requiere un correo válido para confirmar el pago. Puedes usar los correos
                de prueba provistos por la plataforma.
              </p>
            </div>

            <MercadoPagoCardBrick
              amount={Number(productPriceUyu.toFixed(2))}
              description="Auriculares inalámbricos XZ-90"
              locale="es-UY"
              currency="UYU"
              defaultEmail={payerEmail}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800">¿Qué incluye esta demo?</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Integración client-side de Mercado Pago Bricks con carga dinámica del SDK.</li>
              <li>API Route en Next.js que crea pagos usando el SDK oficial de Node.</li>
              <li>Variables de entorno listas para modo sandbox con credenciales de ejemplo.</li>
              <li>Interfaz minimalista pensada para pruebas rápidas sin base de datos.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
