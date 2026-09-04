import { auth } from './firebase';

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
  void details;
  return {
    success: false,
    error: 'Calendar de reserva desativado até a verificação canônica de pagamento da F0.5.',
  };
};

export interface CafeVirtualDetails {
  date: string;
  time: string;
  candidateId?: string;
  idToken?: string;
}

export const scheduleCafeVirtualEvent = async (details: CafeVirtualDetails) => {
  try {
    const idToken = details.idToken ?? await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Autenticação necessária para agendar o Café Virtual.');
    const response = await fetch('/api/create-calendar-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        type: 'cafe-virtual',
        details: {
          date: details.date,
          time: details.time,
          ...(details.candidateId ? { applicationId: details.candidateId } : {}),
        },
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Erro ao agendar Café Virtual no Google Calendar');
    }
    return await response.json();
  } catch (error) {
    console.error('Erro ao agendar Café Virtual:', error);
    return { success: false, error };
  }
};
