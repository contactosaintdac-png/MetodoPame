import { TriageData } from '../types';
import { auth } from '../lib/firebase';

export interface PaymentPayload {
  format: 'meio' | 'completo';
  mode: 'avulso' | 'mensal';
  triageData: TriageData;
  activeAddons: string[];
  clientName: string;
  clientEmail?: string;
  clientPhone: string;
  address: string;
  localDate: string;
  slot: 'full_day' | 'morning' | 'afternoon';
}

export const createPreference = async (payload: PaymentPayload) => {
  try {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/create-preference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        triageData: {
          rooms: payload.triageData.rooms,
          baths: payload.triageData.baths,
          floors: payload.triageData.floors,
          marble: payload.triageData.marble,
          wood: payload.triageData.wood,
          doubleGlass: payload.triageData.doubleGlass,
          chandeliers: payload.triageData.chandeliers,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Payment API Error:", errorData);
      throw new Error(errorData?.error || "Error al comunicarse con el servidor de pagos.");
    }

    const data = await response.json();
    if (data.guestAccessToken && data.orderId) {
      sessionStorage.setItem(`pame_guest_checkout_${data.orderId}`, data.guestAccessToken);
    }
    return data;
  } catch (error) {
    console.error("Error en el servicio de Mercado Pago:", error);
    throw error;
  }
};
