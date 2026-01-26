import { Product } from "@/data/products";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

const handleUnauthorized = () => {
  clearAuthToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
};

export const fetchProductBySku = async (sku: string): Promise<Product | null> => {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const token = getAuthToken();
  const response = await fetch(`/api/products/${encodeURIComponent(trimmed)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) {
    handleUnauthorized();
    return null;
  }
  if (!response.ok) {
    return null;
  }
  const data = await response.json();

  return {
    sku: data.sku,
    name: data.name,
    description: data.description,
    barcode: data.barcode,
    category: data.category,
    brandSegment: data.brandSegment,
    descSegment: data.descSegment,
    normalPrice: Number(data.normalPrice) || 0,
    promoPrice: Number(data.promoPrice) || 0,
    discount: Number(data.discount) || 0,
    extraDiscount: data.extraDiscount ? Number(data.extraDiscount) : undefined,
    disc2: data.disc2 ? Number(data.disc2) : undefined,
    disc3: data.disc3 ? Number(data.disc3) : undefined,
    memberDiscount: data.memberDiscount ? Number(data.memberDiscount) : undefined,
    discountType: data.discountType || "percent",
    uom: data.uom || undefined,
    basePricePerMeter: data.basePricePerMeter ? Number(data.basePricePerMeter) : undefined,
    finalPricePerMeter: data.finalPricePerMeter ? Number(data.finalPricePerMeter) : undefined,
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
  if (response.status === 401) {
    handleUnauthorized();
    return [];
  }
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.map((item: { pd_code: string; pd_short_desc: string }) => ({
    sku: item.pd_code,
    name: item.pd_short_desc,
  }));
};

export const fetchBrandSegments = async (): Promise<string[]> => {
  const token = getAuthToken();
  const response = await fetch("/api/brand-segments", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) {
    handleUnauthorized();
    return [];
  }
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return Array.isArray(data) ? data.filter((item) => typeof item === "string") : [];
};
