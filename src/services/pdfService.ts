import { jsPDF } from 'jspdf';
import { AppConfig, Customer, GarmentType, Order, OrderStatus } from '../models/types';
import { formatDate } from '../utils/dates';
import { calculatePendingBalance, formatCurrency } from '../utils/money';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En confección',
  ready: 'Listo para entrega',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

const getLogoDataUrl = async (logoPath?: string): Promise<string | null> => {
  if (!logoPath) return null;
  if (logoPath.startsWith('data:')) return logoPath;

  try {
    const baseUrl =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const imageUrl = logoPath.startsWith('http')
      ? logoPath
      : `${baseUrl}/${logoPath.replace(/^\//, '')}`;
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer el logo'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const drawRight = (doc: jsPDF, text: string, x: number, y: number) => {
  doc.text(text, x, y, { align: 'right' });
};

export const generateOrderInvoicePdf = async (
  order: Order,
  customer: Customer | null | undefined,
  garment: GarmentType | null | undefined,
  config: AppConfig
) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const currency = config.currency || 'COP';

  const totalPrice = Math.max(0, order.financials?.totalPrice ?? 0);
  const advancePayment = Math.max(0, order.financials?.advancePayment ?? 0);
  const pendingBalance = calculatePendingBalance(totalPrice, advancePayment);
  const isPaid = pendingBalance <= 0 && totalPrice > 0;
  const invoiceNumber = order.id.slice(0, 8).toUpperCase();
  const issuedAt = formatDate(new Date().toISOString());
  const deliveryDate = order.deliveryDate ? formatDate(order.deliveryDate) : 'Por coordinar';
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

  // Encabezado en tono burdeos intenso característico del atelier (#45131e)
  doc.setFillColor(69, 19, 30);
  doc.rect(0, 0, pageWidth, 104, 'F');
  // Filete dorado de separación (#a08a63)
  doc.setFillColor(160, 138, 99);
  doc.rect(0, 104, pageWidth, 3, 'F');

  const logoDataUrl = await getLogoDataUrl(config.logoDataUrl || '/edna-logo.jpg');
  const logoX = margin;
  const logoY = 22;
  let logoWidth = 166;
  let logoHeight = 60;

  if (logoDataUrl) {
    try {
      const format = logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';

      // Calcular proporciones naturales para respetar el aspecto horizontal del logo
      if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
        try {
          const img = new Image();
          img.src = logoDataUrl;
          if (img.complete && img.naturalWidth && img.naturalHeight) {
            const ratio = img.naturalWidth / img.naturalHeight;
            logoHeight = 58;
            logoWidth = Math.min(220, Math.round(logoHeight * ratio));
          } else {
            await new Promise<void>((resolve) => {
              const timer = setTimeout(() => resolve(), 250);
              img.onload = () => {
                clearTimeout(timer);
                if (img.naturalWidth && img.naturalHeight) {
                  const ratio = img.naturalWidth / img.naturalHeight;
                  logoHeight = 58;
                  logoWidth = Math.min(220, Math.round(logoHeight * ratio));
                }
                resolve();
              };
              img.onerror = () => {
                clearTimeout(timer);
                resolve();
              };
            });
          }
        } catch {
          // Mantener medidas calculadas 166x60 (~2.77:1)
        }
      }

      doc.addImage(logoDataUrl, format, logoX, logoY, logoWidth, logoHeight, undefined, 'FAST');
    } catch {
      // Fallback si falla la inserción de la imagen
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX, logoY, 58, 58, 8, 8, 'F');
      doc.setTextColor(69, 19, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('EA', logoX + 29, logoY + 37, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(config.businessName || 'Edna Atelier', logoX + 70, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(220, 205, 185);
      doc.text('Alta costura y confección a medida', logoX + 70, 68);
    }
  } else {
    // Si no hay imagen disponible
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(logoX, logoY, 58, 58, 8, 8, 'F');
    doc.setTextColor(69, 19, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('EA', logoX + 29, logoY + 37, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(config.businessName || 'Edna Atelier', logoX + 70, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(220, 205, 185);
    doc.text('Alta costura y confección a medida', logoX + 70, 68);
  }

  // Información del comprobante en la esquina superior derecha
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  drawRight(doc, 'COMPROBANTE DE PEDIDO', pageWidth - margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(220, 205, 185);
  drawRight(doc, `No. ${invoiceNumber}`, pageWidth - margin, 58);
  drawRight(doc, `Emitido: ${issuedAt}`, pageWidth - margin, 74);

  let y = 132;

  // Info cards
  const colGap = 16;
  const colWidth = (contentWidth - colGap) / 2;
  const cardHeight = 96;
  const leftX = margin;
  const rightX = margin + colWidth + colGap;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(leftX, y, colWidth, cardHeight, 8, 8, 'FD');
  doc.roundedRect(rightX, y, colWidth, cardHeight, 8, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE', leftX + 14, y + 20);
  doc.text('DETALLES DEL PEDIDO', rightX + 14, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const customerName = customer?.fullName?.trim() || 'Cliente no registrado';
  const customerPhone = customer?.phone?.trim() || 'Sin teléfono';
  const customerEmail = customer?.email?.trim();
  doc.text(customerName, leftX + 14, y + 40);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tel: ${customerPhone}`, leftX + 14, y + 58);
  if (customerEmail) {
    doc.text(`Email: ${customerEmail}`, leftX + 14, y + 74);
  }

  doc.setTextColor(30, 41, 59);
  doc.text(`Entrega: ${deliveryDate}`, rightX + 14, y + 40);
  doc.setTextColor(71, 85, 105);
  doc.text(`Estado: ${statusLabel}`, rightX + 14, y + 58);
  doc.text(`Pedido: #${invoiceNumber}`, rightX + 14, y + 74);

  y += cardHeight + 28;

  // Item table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Detalle del encargo', margin, y);
  y += 12;

  const tableTop = y;
  const rowHeight = 34;
  const descW = contentWidth * 0.46;
  const sizeW = contentWidth * 0.14;
  const statusW = contentWidth * 0.2;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, tableTop, contentWidth, 28, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, tableTop, contentWidth, 28);

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPCIÓN', margin + 12, tableTop + 17);
  doc.text('TALLA', margin + descW + 10, tableTop + 17);
  doc.text('ESTADO', margin + descW + sizeW + 10, tableTop + 17);
  drawRight(doc, 'VALOR', margin + contentWidth - 12, tableTop + 17);

  const garmentName = garment?.name || order.garmentType || 'Prenda personalizada';
  const description =
    order.description?.trim() || order.notes?.trim() || 'Sin observaciones adicionales.';
  const descLines = doc.splitTextToSize(`${garmentName}\n${description}`, descW - 20) as string[];
  const descLineHeight = 12;
  const contentRowHeight = Math.max(rowHeight, 18 + descLines.length * descLineHeight);

  const rowY = tableTop + 28;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, rowY, contentWidth, contentRowHeight, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, rowY, contentWidth, contentRowHeight);
  // Column separators
  doc.line(margin + descW, tableTop, margin + descW, rowY + contentRowHeight);
  doc.line(margin + descW + sizeW, tableTop, margin + descW + sizeW, rowY + contentRowHeight);
  doc.line(
    margin + descW + sizeW + statusW,
    tableTop,
    margin + descW + sizeW + statusW,
    rowY + contentRowHeight
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(descLines[0] || garmentName, margin + 12, rowY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  descLines.slice(1, 5).forEach((line, index) => {
    doc.text(line, margin + 12, rowY + 32 + index * descLineHeight);
  });

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(order.size || '—', margin + descW + 10, rowY + 22);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const statusLines = doc.splitTextToSize(statusLabel, statusW - 20) as string[];
  statusLines.slice(0, 2).forEach((line, index) => {
    doc.text(line, margin + descW + sizeW + 10, rowY + 22 + index * 12);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  drawRight(doc, formatCurrency(totalPrice, currency), margin + contentWidth - 12, rowY + 22);

  y = rowY + contentRowHeight + 24;

  // Totals
  const totalsWidth = 250;
  const totalsX = margin + contentWidth - totalsWidth;
  const totalsHeight = isPaid ? 104 : 128;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(totalsX, y, totalsWidth, totalsHeight, 8, 8, 'FD');

  const labelX = totalsX + 16;
  const valueX = totalsX + totalsWidth - 16;
  let ty = y + 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Total del encargo', labelX, ty);
  doc.setTextColor(15, 23, 42);
  drawRight(doc, formatCurrency(totalPrice, currency), valueX, ty);

  ty += 24;
  doc.setTextColor(71, 85, 105);
  doc.text('Abono registrado', labelX, ty);
  doc.setTextColor(5, 150, 105);
  drawRight(doc, `-${formatCurrency(advancePayment, currency)}`, valueX, ty);

  ty += 24;
  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, ty - 10, valueX, ty - 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(isPaid ? 'Estado de pago' : 'Saldo pendiente', labelX, ty);
  if (isPaid) {
    doc.setTextColor(5, 150, 105);
    drawRight(doc, 'PAGADO', valueX, ty);
  } else {
    doc.setTextColor(180, 83, 9);
    drawRight(doc, formatCurrency(pendingBalance, currency), valueX, ty);
  }

  if (!isPaid) {
    ty += 28;
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(labelX - 4, ty - 14, totalsWidth - 24, 24, 4, 4, 'F');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text('Pendiente por cancelar al momento de la entrega.', labelX, ty);
  }

  // Notes / terms
  const notesY = y;
  const notesWidth = contentWidth - totalsWidth - 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('OBSERVACIONES', margin, notesY + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const noteText =
    order.notes?.trim() || order.description?.trim() || 'Sin observaciones adicionales.';
  const noteLines = doc.splitTextToSize(noteText, notesWidth) as string[];
  noteLines.slice(0, 6).forEach((line, index) => {
    doc.text(line, margin, notesY + 20 + index * 13);
  });

  // Footer
  const footerY = pageHeight - 84;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Gracias por confiar en nuestro taller.', margin, footerY + 22);
  doc.text(
    `${config.businessName || 'Edna Atelier'} • Comprobante generado digitalmente`,
    margin,
    footerY + 36
  );

  // Signature lines
  const sigY = footerY - 26;
  const sigWidth = 150;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, sigY, margin + sigWidth, sigY);
  doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma del taller', margin, sigY + 14);
  drawRight(doc, 'Firma del cliente', pageWidth - margin, sigY + 14);

  return doc;
};

export const printOrderTicket = async (
  order: Order,
  customer: Customer | null | undefined,
  garment: GarmentType | null | undefined,
  config: AppConfig
) => {
  if (typeof window === 'undefined') return;

  const pdf = await generateOrderInvoicePdf(order, customer, garment, config);
  const fileName = `comprobante-${order.id.slice(0, 8).toUpperCase()}.pdf`;
  pdf.save(fileName);
};
