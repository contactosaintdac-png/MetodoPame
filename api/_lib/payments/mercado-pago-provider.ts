import { MercadoPagoConfig, Payment } from 'mercadopago';

import { HttpError } from '../http-errors.js';

export interface ProviderPaymentSnapshot {
  id: string;
  status: string;
  statusDetail?: string;
  externalReference: string;
  transactionAmount: number;
  currency: string;
  liveMode: boolean;
  updatedAt: string;
}

export interface PaymentProviderPort {
  getPayment(paymentId: string): Promise<ProviderPaymentSnapshot>;
}

export function expectedMercadoPagoLiveMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.MP_EXPECTED_LIVE_MODE === 'true') return true;
  if (env.MP_EXPECTED_LIVE_MODE === 'false') return false;
  if (env.NODE_ENV === 'production') {
    throw new HttpError(503, 'PAYMENT_ENVIRONMENT_NOT_CONFIGURED', 'Payment environment is unavailable');
  }
  return false;
}

export function createMercadoPagoPaymentProvider(): PaymentProviderPort {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new HttpError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
  const client = new Payment(new MercadoPagoConfig({ accessToken, options: { timeout: 5_000 } }));
  return {
    async getPayment(paymentId) {
      const payment = await client.get({ id: paymentId });
      if (payment.id === undefined || !payment.status || !payment.external_reference
          || typeof payment.transaction_amount !== 'number' || !payment.currency_id
          || typeof payment.live_mode !== 'boolean' || !payment.date_last_updated) {
        throw new HttpError(502, 'PAYMENT_PROVIDER_RESPONSE_INVALID', 'Payment provider returned incomplete data');
      }
      return {
        id: String(payment.id), status: payment.status,
        ...(payment.status_detail ? { statusDetail: payment.status_detail } : {}),
        externalReference: payment.external_reference,
        transactionAmount: payment.transaction_amount,
        currency: payment.currency_id,
        liveMode: payment.live_mode,
        updatedAt: payment.date_last_updated,
      };
    },
  };
}
