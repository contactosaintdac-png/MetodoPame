export const notifyClientAssignment = async (
  clientName: string, 
  clientEmail: string | undefined, 
  date: string, 
  shift: string,
  totalPrice: number,
  employeeName: string,
  employeePhoto: string | undefined
) => {
  try {
    const response = await fetch('/api/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, clientEmail, date, shift, totalPrice, employeeName, employeePhoto })
    });
    const data = await response.json();
    console.log('[Notification to Client]:', data);
  } catch (error) {
    console.error('[Notification Error]:', error);
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
  date: string, 
  shift: string, 
  clientAddress: string,
  addons: string[] = []
) => {
  try {
    const response = await fetch('/api/send-specialist-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName, employeeEmail, date, shift, clientAddress, addons })
    });
    const data = await response.json();
    console.log('[Notification to Employee]:', data);
  } catch (error) {
    console.error('[Notification Error]:', error);
  }
};

export const notifyEmployeeRemoval = async (employeeName: string, employeeEmail: string | undefined, date: string) => {
  // We can implement a removal endpoint similarly if needed, or skip it for now
  console.log(`[Removal Mock]: Olá ${employeeName}, o serviço do dia ${date} foi realocado.`);
};
