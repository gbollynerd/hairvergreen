import 'server-only';
import { paystack } from './paystack';
import type { PaymentProvider } from './types';

const providers: Record<string, PaymentProvider> = { [paystack.id]: paystack };

export function getProvider(id = 'paystack'): PaymentProvider {
  const p = providers[id];
  if (!p) throw new Error(`Unknown payment provider: ${id}`);
  return p;
}
export const listProviders = () => Object.values(providers);
export type { PaymentProvider } from './types';
