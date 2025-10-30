import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

const resolveAccessToken = () =>
  process.env.MERCADO_PAGO_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN ?? null;

type PaymentPayload = {
  token: string;
  payment_method_id: string;
  installments?: number | string | null;
  issuer_id?: string | null;
  transaction_amount: number;
  description?: string | null;
  payer?: {
    email?: string | null;
    identification?: {
      type?: string | null;
      number?: string | null;
    };
  };
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

  if (!body?.token || !body?.payment_method_id || !body?.transaction_amount) {
    return NextResponse.json(
      { error: "Missing required payment fields (token, payment_method_id, transaction_amount)." },
      { status: 400 },
    );
  }

  const payerEmail = body.payer?.email;
  if (!payerEmail) {
    return NextResponse.json({ error: "Payer email is required." }, { status: 400 });
  }

  const client = new MercadoPagoConfig({ accessToken });
  const payment = new Payment(client);

  try {
    const result = await payment.create({
      body: {
        transaction_amount: Number(body.transaction_amount),
        token: body.token,
        description: body.description ?? "Sample payment",
        installments: sanitizeInstallments(body.installments),
        payment_method_id: body.payment_method_id,
        issuer_id: body.issuer_id ?? undefined,
        payer: {
          email: payerEmail,
          identification:
            body.payer?.identification?.type && body.payer.identification.number
              ? {
                  type: body.payer.identification.type,
                  number: body.payer.identification.number,
                }
              : undefined,
        },
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
