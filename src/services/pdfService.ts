// src/services/pdfService.ts
import { jsPDF } from 'jspdf';
import { Order, Customer, GarmentType, AppConfig } from '../models/types';

const formatCurrency = (value: number, currency = 'COP') =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);

const getLogoDataUrl = async (logoPath?: string): Promise<string | null> => {
  if (!logoPath) return null;

  if (logoPath.startsWith('data:')) return logoPath;

  try {
    const imageUrl = `/${logoPath.replace(/^\//, '')}`;
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const generateOrderInvoicePdf = async (
  order: Order,
  customer: Customer,
  garment: GarmentType,
  config: AppConfig
) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 60;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 70, 'F');

  const logoDataUrl = await getLogoDataUrl(config.logoDataUrl || '/edna-logo.svg');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, 12, 42, 42, undefined, 'FAST');
    } catch {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 16, 42, 42, 10, 10, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('EA', margin + 21, 45, { align: 'center' });
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 16, 42, 42, 10, 10, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EA', margin + 21, 45, { align: 'center' });
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.businessName || 'Edna Atelier', margin + 56, 32);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Factura / Comprobante de pedido', margin + 56, 52);

  y = 100;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${customer.fullName || 'Cliente General'}`, margin, y);
  y += 18;
  doc.text(`Teléfono: ${customer.phone || 'No registrado'}`, margin, y);
  y += 18;
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CO')}`, margin, y);
  y += 18;
  doc.text(`Fecha estimada de entrega: ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('es-CO') : 'Por coordinar'}`, margin, y);

  y += 32;
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle del encargo', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.text(`Prenda: ${garment?.name || 'Personalizada'}`, margin, y);
  y += 18;
  doc.text(`Talla: ${order.size || 'No especificada'}`, margin, y);
  y += 18;
  doc.text(`Estado: ${order.status}`, margin, y);
  y += 18;
  doc.text(`Notas: ${order.notes || 'Sin observaciones adicionales.'}`, margin, y);

  y += 36;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 120, 8, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Resumen financiero', margin + 16, y + 20);

  doc.setFont('helvetica', 'normal');
  const rowY = y + 40;
  doc.text('Precio total', margin + 16, rowY);
  doc.text(formatCurrency(order.financials?.totalPrice || 0, config.currency), pageWidth - margin - 16, rowY, { align: 'right' });

  doc.text('Abono registrado', margin + 16, rowY + 24);
  doc.text(formatCurrency(order.financials?.advancePayment || 0, config.currency), pageWidth - margin - 16, rowY + 24, { align: 'right' });

  doc.text('Saldo pendiente', margin + 16, rowY + 48);
  doc.text(formatCurrency(order.financials?.pendingBalance || 0, config.currency), pageWidth - margin - 16, rowY + 48, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL A PAGAR', margin + 16, rowY + 82);
  doc.text(formatCurrency(order.financials?.pendingBalance || 0, config.currency), pageWidth - margin - 16, rowY + 82, { align: 'right' });

  y = 460;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Gracias por confiar en nuestros servicios de confección.', margin, y);
  doc.text(`Número de factura: ${order.id.slice(0, 8).toUpperCase()}`, margin, y + 18);
  doc.text(`Emitido por: ${config.businessName || 'Edna Atelier'}`, margin, y + 36);

  return doc;
};

export const printOrderTicket = async (
  order: Order,
  customer: Customer,
  garment: GarmentType,
  config: AppConfig
) => {
  if (typeof window === 'undefined') return;

  const pdf = await generateOrderInvoicePdf(order, customer, garment, config);
  const fileName = `factura-${order.id.slice(0, 8)}.pdf`;
  pdf.save(fileName);
};