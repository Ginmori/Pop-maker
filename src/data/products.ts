export interface Product {
  sku: string;
  name: string;
  normalPrice: number;
  promoPrice: number;
  discount: number;
  barcode: string;
  brand?: string;
  brandId?: string;
  brandLogoText?: string;
  brandLogoUrl?: string;
  brandColor?: string;
  brandTextColor?: string;
  category?: string;
  brandSegment?: string;
  descSegment?: string;
  discountType?: 'percent' | 'cut';
  discountAmount?: number;
  description?: string;
  extraDiscount?: number;
  memberDiscount?: number;
  isCustom?: boolean;
}

export const products: Record<string, Product> = {};

export const searchProduct = (sku: string): Product | null => {
  const upperSku = sku.toUpperCase();
  return products[upperSku] || null;
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('id-ID').format(price);
};
