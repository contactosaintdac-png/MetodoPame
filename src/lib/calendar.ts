export interface BookingDetails {
  clientName: string;
  date: Date;
  shift: string;
  modality: string;
  addons: string[];
  totalValue: number;
}

export const generateClientCalendarUrl = (details: BookingDetails) => {
  const { clientName, date, shift, modality, addons, totalValue } = details;
  
  // Format dates for Google Calendar (YYYYMMDDTHHmmssZ)
  // Assuming a generic start time of 09:00 AM if Turno Completo or Manhã, 14:00 if Tarde.
  // For simplicity, we create an all-day event format (YYYYMMDD) if specific hours are complex,
  // but let's try to add some hours.
  const start = new Date(date);
  if (shift.toLowerCase().includes('tarde')) {
    start.setHours(14, 0, 0);
  } else {
    start.setHours(9, 0, 0);
  }
  
  const end = new Date(start);
  if (shift.toLowerCase().includes('completo')) {
    end.setHours(start.getHours() + 8);
  } else {
    end.setHours(start.getHours() + 4);
  }

  const startDate = start.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const endDate = end.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const title = encodeURIComponent(`Faxina MÉTODO PAME — ${clientName}`);
  const description = encodeURIComponent(
    `Turno: ${shift}\nModalidade: ${modality}\nAdd-ons: ${addons.length > 0 ? addons.join(", ") : "Nenhum"}\nValor Estimado: R$ ${totalValue}`
  );
  const location = encodeURIComponent("Tijucas, SC");

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}`;

  // Se for pacote mensal, repete semanalmente 4 vezes (1 mês de sessões)
  if (modality.toLowerCase().includes('mensal')) {
    url += `&recur=RRULE:FREQ=WEEKLY;COUNT=4`;
  }

  return url;
};

export const createPameCalendarEvent = async (details: BookingDetails) => {
  // Placeholders for environment variables
  const calendarId = import.meta.env.VITE_GOOGLE_CALENDAR_ID;
  const serviceAccountKey = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY;

  console.log("==========================================");
  console.log("📅 MOCK: Criando evento no Google Calendar da Pame");
  console.log("Calendar ID:", calendarId || "PLACEHOLDER");
  console.log("Service Account:", serviceAccountKey ? "***KEY_PRESENT***" : "PLACEHOLDER");
  console.log("Detalhes do Evento:", details);
  console.log("==========================================");

  /*
  // Em produção, isso deve ser substituído por uma chamada à sua Cloud Function:
  try {
    const response = await fetch('https://us-central1-SEUPROJETO.cloudfunctions.net/createCalendarEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });
    if (!response.ok) throw new Error("Falha ao criar evento");
    return await response.json();
  } catch (error) {
    console.error("Erro na integração com Calendar:", error);
    throw error;
  }
  */

  // Simulando delay de rede
  return new Promise(resolve => setTimeout(() => resolve(true), 1000));
};
