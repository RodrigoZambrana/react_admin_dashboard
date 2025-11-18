interface MercadoPagoBricksController {
  destroy(): void;
  unmount(): void;
  update(settings: Record<string, unknown>): Promise<void>;
}

interface MercadoPagoBricksBuilder {
  create(
    brick: "cardPayment" | "payment",
    containerId: string,
    settings: Record<string, unknown>
  ): Promise<MercadoPagoBricksController>;
}

interface MercadoPagoSdk {
  bricks(): MercadoPagoBricksBuilder;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoSdk;
  }
}

export {};
