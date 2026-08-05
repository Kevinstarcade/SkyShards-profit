export interface BazaarQuickStatus {
  productId: string;
  sellPrice: number;
  sellVolume: number;
  sellMovingWeek: number;
  sellOrders: number;
  buyPrice: number;
  buyVolume: number;
  buyMovingWeek: number;
  buyOrders: number;
}

export interface BazaarData {
  success: boolean;
  lastUpdated?: number;
  products: {
    [key: string]: {
      productId: string;
      sell_summary: {
        [key: number]: {
          amount: number;
          pricePerUnit: number;
          orders: number;
        };
      };
      buy_summary: {
        [key: number]: {
          amount: number;
          pricePerUnit: number;
          orders: number;
        };
      };
      quick_status?: BazaarQuickStatus;
    };
  };
}