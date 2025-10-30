type MercadoPagoBrickName = "payment" | "cardPayment";

interface MercadoPagoBrickController {
  destroy(): void;
}

interface MercadoPagoBricksBuilder {
  create(
    brickName: MercadoPagoBrickName,
    containerId: string,
    settings: Record<string, unknown>
  ): Promise<MercadoPagoBrickController>;
}

interface MercadoPagoSdk {
  bricks(): MercadoPagoBricksBuilder;
}

interface Window {
  MercadoPago?: new (
    publicKey: string,
    options?: {
      locale?: string;
    }
  ) => MercadoPagoSdk;
}
