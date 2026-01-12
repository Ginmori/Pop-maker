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
  discountType?: 'percent' | 'cut';
  discountAmount?: number;
  description?: string;
  extraDiscount?: number;
  memberDiscount?: number;
  isCustom?: boolean;
}

export const products: Record<string, Product> = {
  'SKU001': {
    sku: 'SKU001',
    name: 'Produk ABC',
    normalPrice: 50000,
    promoPrice: 35000,
    discount: 30,
    barcode: '1234567890123',
  },
  'SKU002': {
    sku: 'SKU002',
    name: 'Minyak Goreng Premium 2L',
    normalPrice: 45000,
    promoPrice: 38000,
    discount: 16,
    barcode: '2345678901234',
  },
  'SKU003': {
    sku: 'SKU003',
    name: 'Susu UHT Coklat 1L',
    normalPrice: 18000,
    promoPrice: 15000,
    discount: 17,
    barcode: '3456789012345',
  },
  'SKU004': {
    sku: 'SKU004',
    name: 'Deterjen Bubuk 1kg',
    normalPrice: 32000,
    promoPrice: 25000,
    discount: 22,
    barcode: '4567890123456',
  },
  'SKU005': {
    sku: 'SKU005',
    name: 'Beras Premium 5kg',
    normalPrice: 75000,
    promoPrice: 65000,
    discount: 13,
    barcode: '5678901234567',
  },
};

export const searchProduct = (sku: string): Product | null => {
  const upperSku = sku.toUpperCase();
  return products[upperSku] || null;
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('id-ID').format(price);
};
