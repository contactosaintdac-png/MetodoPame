export interface PaymentPayload {
  title: string;
  totalValue: number;
  clientName: string;
  clientEmail?: string;
}

export const createPreference = async (payload: PaymentPayload) => {
  // Placeholders for environment variables
  const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
  const accessToken = import.meta.env.VITE_MP_ACCESS_TOKEN;

  console.log("==========================================");
  console.log("💳 MOCK: Criando preferência no Mercado Pago");
  console.log("Public Key:", publicKey || "PLACEHOLDER");
  console.log("Access Token:", accessToken ? "***KEY_PRESENT***" : "PLACEHOLDER");
  console.log("Payload:", {
    items: [
      {
        title: payload.title,
        unit_price: payload.totalValue,
        quantity: 1,
      }
    ],
    payer: {
      name: payload.clientName,
      email: payload.clientEmail || "cliente@exemplo.com",
    },
    back_urls: {
      success: window.location.origin + "/success",
      failure: window.location.origin + "/failure",
      pending: window.location.origin + "/pending"
    },
    auto_return: "approved"
  });
  console.log("==========================================");

  // Em produção, isso deve ser substituído por uma chamada à sua Cloud Function!
  // Simulando delay de rede para UX
  return new Promise(resolve => 
    setTimeout(() => resolve({ 
      id: "mock_preference_id", 
      init_point: "https://www.mercadopago.com.br/mock-checkout" 
    }), 1500)
  );
};
