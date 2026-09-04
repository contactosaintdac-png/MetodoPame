const paymentEvidenceUnavailable = async (..._arguments: unknown[]): Promise<never> => {
  throw new Error(
    'Comunicação de reserva desativada até a verificação canônica de pagamento da F0.5.',
  );
};

// F0.2 compatibility signatures. They intentionally perform no HTTP request.
export const notifyClientAssignment = paymentEvidenceUnavailable;
export const notifyAdminNewBooking = paymentEvidenceUnavailable;
export const notifyEmployeeAssignment = paymentEvidenceUnavailable;
export const notifyEmployeeRemoval = paymentEvidenceUnavailable;
