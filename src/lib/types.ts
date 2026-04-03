export type UserRole = 'OWNER' | 'CREW';
export type PaymentMethod = 'CASH' | 'QRIS';
export type AuditAction = 'CREATE' | 'RESTOCK' | 'SALE' | 'ADJUSTMENT';
export type LoyaltyType = 'EARN' | 'REDEEM';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  hpp: number;
  qty: number;
  stock: number;
}

export interface CheckoutInput {
  items: CartItem[];
  customerId?: string;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  pointsToUse?: number;
  note?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
