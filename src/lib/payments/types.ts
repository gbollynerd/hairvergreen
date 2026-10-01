// Payment abstraction. Add a provider (Flutterwave, Moniepoint, Interswitch, Stripe…) by implementing
// PaymentProvider and registering it in lib/payments/index.ts. Order code never talks to a gateway directly.

export type InitializeInput = {
  orderId: string; orderNumber: string; reference: string; email: string; amount: number; currency: string;
  callbackUrl: string; customerName?: string | null; phone?: string | null; metadata?: Record<string, unknown>;
};
export type InitializeResult = { authorizationUrl: string; reference: string; accessCode?: string };

export type VerifiedTransaction = {
  reference: string; status: 'success' | 'failed' | 'abandoned' | 'pending'; amount: number; currency: string;
  channel: string | null; fees: number | null; paidAt: string | null; providerTransactionId: string | null;
  customerEmail: string | null; raw: unknown; orderId: string | null;
};

export type RefundInput = { reference: string; amount: number; currency: string; reason?: string };
export type RefundResult = { status: 'pending' | 'processing' | 'processed' | 'failed'; providerRefundId: string | null; raw: unknown };

export type WebhookEvent =
  | { type: 'charge.success'; transaction: VerifiedTransaction; eventKey: string; raw: unknown }
  | { type: 'charge.failed'; reference: string; orderId: string | null; eventKey: string; raw: unknown }
  | { type: 'refund.processed' | 'refund.failed' | 'refund.pending'; reference: string; providerRefundId: string | null; amount: number; eventKey: string; raw: unknown }
  | { type: 'ignored'; eventKey: string; raw: unknown; name: string };

export interface PaymentProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifiedTransaction>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Verifies the signature and parses the event. Returns null when the signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
}
