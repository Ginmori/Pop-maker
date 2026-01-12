import { Product } from "@/data/products";
import { getAuthToken } from "@/lib/auth";

export const fetchProductBySku = async (sku: string): Promise<Product | null> => {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const token = getAuthToken();
  const response = await fetch(`/api/products/${encodeURIComponent(trimmed)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();

  return {
    sku: data.sku,
    name: data.name,
    description: data.description,
    barcode: data.barcode,
    normalPrice: Number(data.normalPrice) || 0,
    promoPrice: Number(data.promoPrice) || 0,
    discount: Number(data.discount) || 0,
    extraDiscount: data.extraDiscount ? Number(data.extraDiscount) : undefined,
    memberDiscount: data.memberDiscount ? Number(data.memberDiscount) : undefined,
    discountType: data.discountType || "percent",
  };
};

export interface ProductSuggestion {
  sku: string;
  name: string;
}

export const searchProducts = async (search: string): Promise<ProductSuggestion[]> => {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const token = getAuthToken();
  const response = await fetch(`/api/products?search=${encodeURIComponent(trimmed)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.map((item: { pd_code: string; pd_short_desc: string }) => ({
    sku: item.pd_code,
    name: item.pd_short_desc,
  }));
};
