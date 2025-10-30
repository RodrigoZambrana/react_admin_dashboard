import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

const resolveAccessToken = () =>
  process.env.MERCADO_PAGO_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN ?? null;

type PaymentPayload = {
  token?: string;
  payment_method_id?: string;
  paymentMethodId?: string;
  payment_type_id?: string;
  paymentTypeId?: string;
  installments?: number | string | null;
  issuer_id?: string | null;
  issuerId?: string | null;
  transaction_amount?: number | string | null;
  transactionAmount?: number | string | null;
  description?: string | null;
  preferenceId?: string | null;
  preference_id?: string | null;
  payer?: {
    email?: string | null;
    identification?: {
      type?: string | null;
      number?: string | null;
    };
    first_name?: string | null;
    last_name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  payerCamelCase?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    identification?: {
      type?: string | null;
      number?: string | null;
    };
  };
  rawFormData?: Record<string, unknown> | null;
  metadata?: unknown;
  additional_info?: unknown;
  additionalInfo?: unknown;
  selectedPaymentMethod?: unknown;
};

const sanitizeInstallments = (value: PaymentPayload["installments"]): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }
  return 1;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEmail = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return /\S+@\S+\.\S+/.test(normalized) ? normalized : null;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const sanitizeIdentification = (value: unknown) => {
  if (!isPlainObject(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = normalizeString(record["type"]);
  const number = normalizeString(record["number"]);

  if (!type || !number) {
    return null;
  }

  return { type, number };
};

const resolvePayerCandidate = (body: PaymentPayload): Record<string, unknown> | null => {
  const candidates: unknown[] = [];
  if (body.payer) candidates.push(body.payer);
  if (body.payerCamelCase) candidates.push(body.payerCamelCase);
  if (body.rawFormData && isPlainObject(body.rawFormData["payer"])) {
    candidates.push(body.rawFormData["payer"]);
  }
  for (const candidate of candidates) {
    if (isPlainObject(candidate)) {
      return candidate;
    }
  }
  return null;
};

const sanitizePayer = (body: PaymentPayload) => {
  const candidate = resolvePayerCandidate(body);
  const emailCandidate =
    normalizeEmail(candidate?.["email"]) ??
    normalizeEmail(body.payer?.email) ??
    normalizeEmail(body.payerCamelCase?.email);

  if (!emailCandidate) {
    return null;
  }

  const firstName =
    normalizeString(candidate?.["first_name"] ?? candidate?.["firstName"]) ??
    normalizeString(body.payer?.first_name ?? body.payer?.firstName) ??
    normalizeString(body.payerCamelCase?.firstName);
  const lastName =
    normalizeString(candidate?.["last_name"] ?? candidate?.["lastName"]) ??
    normalizeString(body.payer?.last_name ?? body.payer?.lastName) ??
    normalizeString(body.payerCamelCase?.lastName);

  const identificationCandidate =
    candidate?.["identification"] ?? body.payer?.identification ?? body.payerCamelCase?.identification;
  const identification = sanitizeIdentification(identificationCandidate);

  const payer: Record<string, unknown> = {
    email: emailCandidate,
  };

  if (identification) {
    payer.identification = identification;
  }

  if (firstName) {
    payer.first_name = firstName;
  }
  if (lastName) {
    payer.last_name = lastName;
  }

  return payer;
};

export async function POST(request: Request) {
  const accessToken = resolveAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: "Mercado Pago access token is not configured in the environment." },
      { status: 500 },
    );
  }

  let body: PaymentPayload;
  try {
    body = (await request.json()) as PaymentPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const token = normalizeString(body?.token);
  const paymentMethodId = normalizeString(body?.payment_method_id ?? body?.paymentMethodId);
  const paymentTypeId = normalizeString(body?.payment_type_id ?? body?.paymentTypeId);
  const issuerId = normalizeString(body?.issuer_id ?? body?.issuerId);
  const transactionAmountValue = normalizeNumber(
    body?.transaction_amount ?? body?.transactionAmount,
  );

  if (!paymentMethodId || transactionAmountValue === null || transactionAmountValue <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid required payment fields (payment_method_id, transaction_amount)." },
      { status: 400 },
    );
  }

  const payer = sanitizePayer(body);
  if (!payer) {
    return NextResponse.json(
      { error: "Payer email is required." },
      { status: 400 },
    );
  }

  const sanitizedInstallments = sanitizeInstallments(body.installments);
  const hasInstallmentsInput = body.installments !== null && body.installments !== undefined;

  const metadataSources = [body.metadata, body.rawFormData?.["metadata"]];
  const metadata: Record<string, unknown> = {};
  for (const source of metadataSources) {
    if (isPlainObject(source)) {
      Object.assign(metadata, source);
    }
  }

  const normalizedPreferenceId = normalizeString(body.preferenceId ?? body.preference_id);
  if (normalizedPreferenceId) {
    metadata.preferenceId = normalizedPreferenceId;
    metadata.preference_id = normalizedPreferenceId;
  }

  if (body.selectedPaymentMethod !== undefined) {
    metadata.selectedPaymentMethod = body.selectedPaymentMethod;
  }

  const additionalInfoSources = [
    body.additional_info,
    body.additionalInfo,
    body.rawFormData?.["additional_info"],
  ];
  let additionalInfo: Record<string, unknown> | undefined;
  for (const source of additionalInfoSources) {
    if (isPlainObject(source)) {
      additionalInfo = { ...(source as Record<string, unknown>) };
      break;
    }
  }

  const client = new MercadoPagoConfig({ accessToken });
  const payment = new Payment(client);

  try {
    const result = await payment.create({
      body: {
        transaction_amount: transactionAmountValue,
        token: token ?? undefined,
        description: normalizeString(body.description) ?? "Sample payment",
        ...(hasInstallmentsInput || sanitizedInstallments > 1
          ? { installments: sanitizedInstallments }
          : {}),
        payment_method_id: paymentMethodId,
        issuer_id: issuerId ?? undefined,
        payment_type_id: paymentTypeId ?? undefined,
        payer: payer,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        ...(additionalInfo ? { additional_info: additionalInfo } : {}),
      },
    });

    return NextResponse.json(
      {
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while creating payment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
