import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

const resolveAccessToken = () =>
  process.env.MERCADO_PAGO_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN ?? null;

type BackUrls = {
  success?: string | null;
  failure?: string | null;
  pending?: string | null;
};

type PreferenceRequestBody = {
  id?: string | number | null;
  title?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  unitPrice?: number | string | null;
  back_urls?: BackUrls | null;
  backUrls?: BackUrls | null;
  notification_url?: string | null;
  notificationUrl?: string | null;
  statement_descriptor?: string | null;
  statementDescriptor?: string | null;
  installments?: number | string | null;
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeQuantity = (value: unknown): number | undefined => {
  const parsed = normalizeNumber(value);
  if (parsed === undefined) return undefined;
  const safe = Math.trunc(parsed);
  return safe > 0 ? safe : undefined;
};

const sanitizeBackUrls = (value: unknown): BackUrls | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const success = normalizeText(record.success);
  const failure = normalizeText(record.failure);
  const pending = normalizeText(record.pending);

  const sanitized: BackUrls = {};
  if (success) sanitized.success = success;
  if (failure) sanitized.failure = failure;
  if (pending) sanitized.pending = pending;

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const clampStatementDescriptor = (value: unknown): string | undefined => {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  return normalized.slice(0, 13);
};

export async function POST(request: Request) {
  const accessToken = resolveAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: "Mercado Pago access token is not configured in the environment." },
      { status: 500 },
    );
  }

  let body: PreferenceRequestBody = {};
  try {
    body = (await request.json()) as PreferenceRequestBody;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
  }

  const itemId = normalizeText(body.id);
  const title = normalizeText(body.title) ?? "Producto de ejemplo";
  const quantity = normalizeQuantity(body.quantity) ?? 1;
  const unitPrice = normalizeNumber(body.unit_price ?? body.unitPrice) ?? 1234;
  const backUrls =
    sanitizeBackUrls(body.back_urls) ?? sanitizeBackUrls(body.backUrls) ?? {
      success: "https://tu-dominio/success",
      failure: "https://tu-dominio/failure",
      pending: "https://tu-dominio/pending",
    };
  const notificationUrl = normalizeText(body.notification_url ?? body.notificationUrl);
  const statementDescriptor = clampStatementDescriptor(
    body.statement_descriptor ?? body.statementDescriptor,
  );
  const installments = normalizeQuantity(body.installments);

  const preference = new Preference(new MercadoPagoConfig({ accessToken }));

  try {
    const response = await preference.create({
      body: {
        items: [
          {
            id: itemId ?? "sku-123",
            title,
            quantity,
            unit_price: unitPrice,
          },
        ],
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          ...(installments ? { installments } : {}),
        },
        // ⚠️ No incluir `purpose: "wallet_purchase"` para mantener habilitados
        // todos los medios soportados por la cuenta (tarjetas, transferencias,
        // wallet, etc.).
        ...(backUrls ? { back_urls: backUrls } : {}),
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        ...(statementDescriptor ? { statement_descriptor: statementDescriptor } : {}),
        auto_return: "approved",
      },
    });

    const preferenceId = (response as any)?.id ?? (response as any)?.response?.id;

    if (!preferenceId) {
      return NextResponse.json(
        { error: "Mercado Pago preference response did not include an id." },
        { status: 502 },
      );
    }

    return NextResponse.json({ preferenceId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while creating preference.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
