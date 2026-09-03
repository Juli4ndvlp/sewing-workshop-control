export interface FinancialSummary {
  netProfit: number;
  profitMarginPercentage: number;
  pendingBalance: number;
  isFullyPaid: boolean;
}

export class FinancialService {
  /**
   * Calcula la rentabilidad y saldos basados en la regla de negocio:
   * Margen (%) = (Ganancia / Costo) * 100
   */
  static calculateOrderFinancials(
    manufacturingCost: number,
    salePrice: number,
    advancePayment: number
  ): FinancialSummary {
    const cost = Math.max(0, manufacturingCost);
    const price = Math.max(0, salePrice);
    const advance = Math.max(0, advancePayment);

    const netProfit = price - cost;
    const profitMarginPercentage = cost > 0 ? (netProfit / cost) * 100 : 0;
    const pendingBalance = Math.max(0, price - advance);
    const isFullyPaid = pendingBalance === 0 && price > 0;

    return {
      netProfit: Number(netProfit.toFixed(2)),
      profitMarginPercentage: Number(profitMarginPercentage.toFixed(1)),
      pendingBalance: Number(pendingBalance.toFixed(2)),
      isFullyPaid
    };
  }
}