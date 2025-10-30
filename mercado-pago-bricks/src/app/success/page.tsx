import Link from "next/link";

type SuccessPageSearchParams = {
  paymentId?: string;
  status?: string;
  detail?: string;
};

type SuccessPageProps = {
  searchParams: Promise<SuccessPageSearchParams> | SuccessPageSearchParams;
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const paymentId = resolvedSearchParams.paymentId ?? "desconocido";
  const status = resolvedSearchParams.status ?? "approved";
  const detail = resolvedSearchParams.detail ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6 py-16 text-slate-900">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-lg">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600">Pago confirmado</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">¡Gracias por completar la prueba!</h1>
          <p className="mt-2 text-sm text-slate-500">
            Este flujo utiliza credenciales sandbox de Mercado Pago. Puedes volver al inicio para realizar otra simulación.
          </p>
        </div>

        <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          <div className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado reportado</dt>
            <dd className="text-base font-medium text-green-700">{status}</dd>
          </div>

          <div className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificador del pago</dt>
            <dd className="text-base font-medium text-slate-800">{paymentId}</dd>
          </div>

          {detail ? (
            <div className="grid gap-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle adicional</dt>
              <dd className="text-base text-slate-700">{detail}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Volver al inicio
          </Link>
          <Link
            href="https://www.mercadopago.com/developers/es/docs/checkout-bricks"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Documentación de Bricks
          </Link>
        </div>
      </div>
    </main>
  );
}
