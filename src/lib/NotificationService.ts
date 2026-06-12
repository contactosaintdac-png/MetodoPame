export const notifyClientAssignment = async (
  clientName: string, 
  clientEmail: string | undefined, 
  clientPhone: string,
  date: string, 
  shift: string,
  totalPrice: number,
  employeeName: string,
  employeePhoto: string | undefined,
  employeeId?: string
) => {
  // 1. Email confirmation via Resend
  try {
    const response = await fetch('/api/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, clientEmail, date, shift, totalPrice, employeeName, employeePhoto, employeeId })
    });
    const data = await response.json();
    console.log('[Notification Email to Client]:', data);
  } catch (error) {
    console.error('[Notification Email Error]:', error);
  }

  // 2. WhatsApp notification via Meta
  try {
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: clientPhone,
        templateName: 'reserva_confirmada_cliente',
        parameters: [clientName, date, shift, employeeName, totalPrice]
      })
    });
    const data = await response.json();
    console.log('[Notification WhatsApp to Client]:', data);
  } catch (error) {
    console.error('[Notification WhatsApp Error]:', error);
  }
};

export const notifyAdminNewBooking = async (
  clientName: string,
  date: string,
  shift: string,
  totalPrice: number,
  employeeName: string,
  addons: string[]
) => {
  try {
    const response = await fetch('/api/send-admin-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, date, shift, totalPrice, employeeName, addons })
    });
    const data = await response.json();
    console.log('[Notification to Admin]:', data);
  } catch (error) {
    console.error('[Notification Error]:', error);
  }
};

export const notifyEmployeeAssignment = async (
  employeeName: string, 
  employeeEmail: string | undefined, 
  employeePhone: string | undefined,
  date: string, 
  shift: string, 
  clientAddress: string,
  addons: string[] = [],
  employeeId?: string
) => {
  // 1. Email notification via Resend
  try {
    const response = await fetch('/api/send-specialist-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName, employeeEmail, date, shift, clientAddress, addons, employeeId })
    });
    const data = await response.json();
    console.log('[Notification Email to Employee]:', data);
  } catch (error) {
    console.error('[Notification Email Error]:', error);
  }

  // 2. WhatsApp notification via Meta
  try {
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: employeePhone,
        employeeId,
        templateName: 'novo_servico_especialista',
        parameters: [employeeName, date, shift, clientAddress, addons.join(', ') || 'Nenhum']
      })
    });
    const data = await response.json();
    console.log('[Notification WhatsApp to Employee]:', data);
  } catch (error) {
    console.error('[Notification WhatsApp Error]:', error);
  }
};

export const notifyEmployeeRemoval = async (
  employeeName: string,
  employeeEmail: string | undefined,
  employeePhone: string | undefined,
  date: string,
  employeeId?: string
) => {
  console.log(`[Removal Mock Email]: Olá ${employeeName}, o serviço do dia ${date} foi realocado.`);

  // WhatsApp notification via Meta
  try {
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: employeePhone,
        employeeId,
        templateName: 'remocao_servico_especialista',
        parameters: [employeeName, date]
      })
    });
    const data = await response.json();
    console.log('[Notification WhatsApp to Employee (Removal)]:', data);
  } catch (error) {
    console.error('[Notification WhatsApp Error]:', error);
  }
};
