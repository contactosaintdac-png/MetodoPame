export interface PaymentPayload {
  title: string;
  totalValue: number;
  clientName: string;
  clientEmail?: string;
}

export const createPreference = async (payload: PaymentPayload) => {
  try {
    const response = await fetch('/api/create-preference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Payment API Error:", errorData);
      throw new Error(errorData?.error || "Error al comunicarse con el servidor de pagos.");
    }

    const data = await response.json();
    return data; // Returns { id, init_point, sandbox_init_point }
  } catch (error) {
    console.error("Error en el servicio de Mercado Pago:", error);
    throw error;
  }
};
