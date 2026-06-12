/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Booking } from '../types';

export function generateInvoiceHTML(booking: Booking, clientName?: string, clientEmail?: string): string {
  const invoiceId = `FAT-${(booking.id || '0000').slice(0, 6).toUpperCase()}`;
  const formattedDate = new Date(booking.date + "T12:00:00").toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  
  let formattedIssueDate = new Date().toLocaleDateString('pt-BR');
  if (booking.createdAt) {
    if (typeof booking.createdAt === 'string') {
      const parsedDate = new Date(booking.createdAt);
      if (!isNaN(parsedDate.getTime())) {
        formattedIssueDate = parsedDate.toLocaleDateString('pt-BR');
      }
    } else if (booking.createdAt.seconds !== undefined) {
      formattedIssueDate = new Date(booking.createdAt.seconds * 1000).toLocaleDateString('pt-BR');
    } else if (typeof booking.createdAt.toDate === 'function') {
      formattedIssueDate = booking.createdAt.toDate().toLocaleDateString('pt-BR');
    } else {
      const parsedDate = new Date(booking.createdAt);
      if (!isNaN(parsedDate.getTime())) {
        formattedIssueDate = parsedDate.toLocaleDateString('pt-BR');
      }
    }
  }

  const addonsList = booking.addons && booking.addons.length > 0
    ? booking.addons.map(addon => `<li style="margin-bottom: 4px; color: #4e434e;">• ${addon}</li>`).join('')
    : '<li style="color: #80737f; font-style: italic;">Nenhum opcional selecionado</li>';

  const formatText = booking.format === 'completo' ? 'Período Integral' : 'Meio Período';
  const nameToUse = booking.clientName || clientName || 'Cliente Método Pame';
  const emailToUse = booking.clientEmail || clientEmail || 'Não informado';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Fatura ${invoiceId} - Método Pame</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Manrope', sans-serif;
          color: #1e1a20;
          background: #ffffff;
          line-height: 1.6;
          padding: 40px;
        }
        .invoice-card {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #efe5ee;
          border-radius: 16px;
          padding: 40px;
          background: #fafafa;
          box-shadow: 0 4px 20px rgba(86, 22, 104, 0.03);
          position: relative;
          overflow: hidden;
        }
        .invoice-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #561668 0%, #c5a880 100%);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #efe5ee;
          padding-bottom: 24px;
          margin-bottom: 30px;
        }
        .logo-area h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 32px;
          font-weight: 600;
          color: #561668;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .logo-area p {
          font-size: 11px;
          color: #c5a880;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 1.5px;
          margin-top: 4px;
        }
        .invoice-meta {
          text-align: right;
        }
        .invoice-meta h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px;
          font-style: italic;
          color: #561668;
          margin-bottom: 6px;
        }
        .invoice-meta p {
          font-size: 13px;
          color: #80737f;
        }
        .invoice-meta strong {
          color: #1e1a20;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 35px;
        }
        .section-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #c5a880;
          font-weight: 700;
          border-bottom: 1px solid #efe5ee;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }
        .detail-block p {
          font-size: 13px;
          margin-bottom: 4px;
        }
        .detail-block strong {
          color: #561668;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 35px;
        }
        .items-table th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #80737f;
          padding: 12px 16px;
          border-bottom: 2px solid #efe5ee;
          text-align: left;
        }
        .items-table td {
          padding: 16px;
          border-bottom: 1px solid #efe5ee;
          font-size: 13px;
        }
        .item-desc strong {
          color: #561668;
          font-size: 14px;
        }
        .item-desc p {
          font-size: 11px;
          color: #80737f;
          margin-top: 4px;
        }
        .total-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 40px;
        }
        .total-box {
          background: #faf1fa;
          border: 1px solid #efe5ee;
          border-left: 4px solid #561668;
          border-radius: 8px;
          padding: 20px 30px;
          text-align: right;
          min-width: 250px;
        }
        .total-box p {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #80737f;
          margin-bottom: 4px;
          font-weight: 700;
        }
        .total-box h3 {
          font-size: 24px;
          color: #561668;
          font-weight: 700;
        }
        .payment-badge {
          display: inline-flex;
          align-items: center;
          background: #e2f5ec;
          color: #0d7a4b;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 10px;
          border-radius: 12px;
          margin-top: 10px;
        }
        .footer {
          text-align: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px;
          font-style: italic;
          color: #80737f;
          border-top: 1px solid #efe5ee;
          padding-top: 24px;
          margin-top: 20px;
        }
        .footer p {
          margin-bottom: 4px;
        }
        .footer span {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
          color: #c5a880;
          display: block;
          margin-top: 8px;
        }
        
        .print-btn-bar {
          max-width: 800px;
          margin: 0 auto 20px auto;
          display: flex;
          justify-content: flex-end;
        }
        .print-button {
          background: #561668;
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(86, 22, 104, 0.15);
          transition: background 0.2s;
        }
        .print-button:hover {
          background: #41104e;
        }

        @media print {
          body {
            padding: 0;
            background: #fff;
          }
          .invoice-card {
            border: none;
            box-shadow: none;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar no-print">
        <button class="print-button" onclick="window.print()">
          <span>🖨️ Imprimir / Salvar PDF</span>
        </button>
      </div>
      <div class="invoice-card">
        <div class="header">
          <div class="logo-area">
            <h1>Método Pame</h1>
            <p>Home Detail &amp; Bem-Estar</p>
          </div>
          <div class="invoice-meta">
            <h2>Comprovante</h2>
            <p>Ref: <strong>${invoiceId}</strong></p>
            <p>Emissão: <strong>${formattedIssueDate}</strong></p>
          </div>
        </div>

        <div class="details-grid">
          <div class="detail-block">
            <h3 class="section-title">Destinatário</h3>
            <p><strong>Nome:</strong> ${nameToUse}</p>
            <p><strong>E-mail:</strong> ${emailToUse}</p>
            <p><strong>Contato:</strong> ${booking.clientPhone || 'Não informado'}</p>
          </div>
          <div class="detail-block">
            <h3 class="section-title">Serviço &amp; Data</h3>
            <p><strong>Data de Execução:</strong> ${formattedDate}</p>
            <p><strong>Formato:</strong> ${formatText}</p>
            <p><strong>Modalidade:</strong> ${booking.modality || 'Limpeza Residencial Detalhada'}</p>
            ${booking.employeeName ? `<p><strong>Especialista:</strong> ${booking.employeeName}</p>` : ''}
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 70%;">Descrição do Serviço</th>
              <th style="width: 30%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="item-desc">
                <strong>Atendimento Método Pame</strong>
                <p>Serviço de higienização de alto padrão e detalhamento residencial.</p>
                <div style="margin-top: 10px;">
                  <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #561668; letter-spacing: 0.5px;">Opcionais inclusos:</span>
                  <ul style="list-style: none; margin-top: 5px; padding-left: 0;">
                    ${addonsList}
                  </ul>
                </div>
              </td>
              <td style="text-align: right; font-weight: 700; font-size: 14px; color: #561668; vertical-align: top;">
                R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <p>Total Pago</p>
            <h3>R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <div>
              <span class="payment-badge">✓ Pago via Mercado Pago</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>"Detalhes e luxo que transformam seu lar em um refúgio de paz."</p>
          <span>Método Pame © 2026</span>
        </div>
      </div>
      <script>
        // Auto trigger print after load
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 500);
        });
      </script>
    </body>
    </html>
  `;
}

export function openInvoiceWindow(booking: Booking, clientName?: string, clientEmail?: string) {
  const invoiceWindow = window.open('', '_blank');
  if (invoiceWindow) {
    invoiceWindow.document.write(generateInvoiceHTML(booking, clientName, clientEmail));
    invoiceWindow.document.close();
  } else {
    alert('Por favor, permita pop-ups para fazer o download da fatura.');
  }
}
