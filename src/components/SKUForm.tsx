import { useEffect, useState } from 'react';
import { Product, searchProduct, formatPrice } from '@/data/products';
import { fetchBrandSegments, fetchProductBySku, searchProducts, ProductSuggestion } from '@/lib/productApi';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Brand } from '@/data/brands';

interface SKUFormProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onRemoveProduct: (sku: string) => void;
  onSelectProduct?: (sku: string) => void;
  activeSku?: string;
  brands: Brand[];
  disabled?: boolean;
}

export const SKUForm = ({ products, onAddProduct, onRemoveProduct, onSelectProduct, activeSku, brands, disabled = false }: SKUFormProps) => {
  const [mode, setMode] = useState<'sku' | 'custom'>('sku');
  const [skuInput, setSkuInput] = useState('');
  const [skuSuggestions, setSkuSuggestions] = useState<ProductSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceMode, setPriceMode] = useState<'discount' | 'cut'>('discount');
  const [nameInput, setNameInput] = useState('');
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [uomInput, setUomInput] = useState('');
  const [normalPriceInput, setNormalPriceInput] = useState('');
  const [finalPriceInput, setFinalPriceInput] = useState('');
  const [baseDiscountInput, setBaseDiscountInput] = useState('');
  const [priceCutInput, setPriceCutInput] = useState('');
  const [extraDiscountInput, setExtraDiscountInput] = useState('');
  const [memberDiscountInput, setMemberDiscountInput] = useState('');
  const [upToInput, setUpToInput] = useState(false);

  const findBrand = (id?: string) => brands.find((b) => b.id === id);
  const normalizeSku = (value: string) => value.replace(/\s+/g, '');

  useEffect(() => {
    if (disabled) {
      setSkuSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (mode !== 'sku') {
      setSkuSuggestions([]);
      setIsSearching(false);
      return;
    }

    const query = skuInput.trim();
    if (!query) {
      setSkuSuggestions([]);
      setIsSearching(false);
      return;
    }

    let isActive = true;
    setIsSearching(true);
    const handle = setTimeout(async () => {
      const results = await searchProducts(query);
      if (isActive) {
        setSkuSuggestions(results);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [disabled, skuInput, mode]);

  useEffect(() => {
    if (mode !== 'custom') return;
    if (brandOptions.length > 0) return;

    let isActive = true;
    setIsLoadingBrands(true);
    fetchBrandSegments()
      .then((brands) => {
        if (!isActive) return;
        setBrandOptions(brands);
        if (!customBrandInput && brands.length > 0) {
          setCustomBrandInput(brands[0]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingBrands(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [brandOptions.length, customBrandInput, mode]);

  const handleSearch = async (overrideSku?: string) => {
    if (disabled) return;
    const skuValue = normalizeSku(overrideSku ?? skuInput);
    if (!skuValue) {
      toast.error('Masukkan SKU terlebih dahulu');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      let product = await fetchProductBySku(skuValue);
      if (!product) {
        product = searchProduct(skuValue);
      }
      if (product) {
        const exists = products.find((p) => p.sku === product.sku);
        if (exists) {
          toast.error('Produk sudah ditambahkan');
          return;
        }
        const selectedBrand = findBrand(brands[0]?.id);
        const brandName = selectedBrand?.name;
        const brandSource = product.brandSegment || brandName;
        const brandSlug = brandSource ? brandSource.toUpperCase().replace(/\s+/g, '_') : undefined;
        const brandLogoUrl = product.brandLogoUrl || (brandSlug ? `/brands/${brandSlug}.png` : selectedBrand?.logoData);

        const enrichedProduct: Product = {
          ...product,
          brandId: selectedBrand?.id,
          brand: product.brandSegment || brandName,
          brandLogoText: selectedBrand?.logoText,
          brandLogoUrl,
          brandColor: selectedBrand?.logoBg,
          brandTextColor: selectedBrand?.logoTextColor,
          discountType: 'percent',
        };

        onAddProduct(enrichedProduct);
        setSkuInput('');
        setSkuSuggestions([]);
        toast.success(`Produk ${product.name} ditambahkan`);
      } else {
        toast.error('SKU tidak ditemukan');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSearch();
    }
  };

  const handleSelectSuggestion = (suggestion: ProductSuggestion) => {
    const normalizedSku = normalizeSku(suggestion.sku);
    setSkuInput(normalizedSku);
    setSkuSuggestions([]);
    void handleSearch(normalizedSku);
  };

  const resetCustomInputs = () => {
    setPriceMode('discount');
    setNameInput('');
    setCustomBrandInput(brandOptions[0] || '');
    setDescriptionInput('');
    setUomInput('');
    setNormalPriceInput('');
    setFinalPriceInput('');
    setBaseDiscountInput('');
    setPriceCutInput('');
    setExtraDiscountInput('');
    setMemberDiscountInput('');
    setUpToInput(false);
  };

  const handleAddCustomProduct = () => {
    if (disabled) return;
    const brandName = customBrandInput.trim();
    const brandSlug = brandName
      ? brandName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      : undefined;
    const brandLogoUrl = brandSlug ? `/brands/${brandSlug}.png` : undefined;
    const safeName = nameInput.trim() || 'Produk Custom';

    const normalPrice = normalPriceInput ? Number(normalPriceInput) : 0;
    if (normalPriceInput && (!Number.isFinite(normalPrice) || normalPrice <= 0)) {
      toast.error('Harga normal tidak valid');
      return;
    }

    const finalPrice = finalPriceInput ? Number(finalPriceInput) : normalPrice;
    if (finalPriceInput && (!Number.isFinite(finalPrice) || finalPrice < 0)) {
      toast.error('Harga final tidak valid');
      return;
    }

    let promoPrice = finalPrice;
    let discountPercent = 0;
    let extraDiscount = 0;
    let memberDiscount = 0;
    let discountType: 'percent' | 'cut' = 'percent';
    let discountAmount: number | undefined;

    if (priceMode === 'discount') {
      const baseDiscount = baseDiscountInput ? Number(baseDiscountInput) : 0;
      extraDiscount = extraDiscountInput ? Number(extraDiscountInput) : 0;
      memberDiscount = memberDiscountInput ? Number(memberDiscountInput) : 0;

      if (!Number.isFinite(baseDiscount) || baseDiscount < 0) {
        toast.error('Diskon utama tidak valid');
        return;
      }
      if (!Number.isFinite(extraDiscount) || extraDiscount < 0) {
        toast.error('Extra Diskon tidak valid');
        return;
      }
      if (!Number.isFinite(memberDiscount) || memberDiscount < 0) {
        toast.error('Diskon Member tidak valid');
        return;
      }

      discountPercent = baseDiscount;
      promoPrice = finalPrice;
    } else {
      const priceCut = priceCutInput ? Number(priceCutInput) : 0;
      if (priceCutInput && (!Number.isFinite(priceCut) || priceCut <= 0)) {
        toast.error('Potongan harga tidak valid');
        return;
      }
      if (priceCut > 0 && normalPrice > 0 && priceCut >= normalPrice) {
        toast.error('Potongan harga tidak boleh melebihi harga normal');
        return;
      }
      promoPrice = finalPrice;
      discountPercent = priceCut > 0 && normalPrice > 0 ? Math.round((priceCut / normalPrice) * 100) : 0;
      extraDiscount = 0;
      memberDiscount = 0;
      discountType = 'cut';
      discountAmount = priceCut > 0 ? priceCut : undefined;
    }

    const id = `CUSTOM-${Date.now()}`;

    const product: Product = {
      sku: id,
      name: safeName,
      brandId: brandSlug,
      brand: brandName || undefined,
      brandLogoUrl,
      description: descriptionInput.trim() || undefined,
      uom: uomInput.trim() || undefined,
      normalPrice,
      promoPrice,
      discount: discountPercent,
      discountType,
      discountAmount,
      barcode: id,
      extraDiscount: extraDiscount || undefined,
      memberDiscount: memberDiscount || undefined,
      upTo: upToInput || undefined,
      isCustom: true,
    };

    onAddProduct(product);
    toast.success(`Produk custom "${nameInput}" ditambahkan`);
    resetCustomInputs();
  };

  return (
    <div className="space-y-3">
      <h3 className="section-title">Produk / SKU</h3>

      {/* Brand Selector removed */}

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === 'sku' ? 'default' : 'secondary'}
          onClick={() => setMode('sku')}
          className="w-full"
          disabled={disabled}
        >
          Input SKU
        </Button>
        <Button
          variant={mode === 'custom' ? 'default' : 'secondary'}
          onClick={() => setMode('custom')}
          className="w-full"
          disabled={disabled}
        >
          Custom
        </Button>
      </div>

      {mode === 'sku' ? (
        <>
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Masukkan SKU"
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              disabled={disabled}
            />
            <Button onClick={handleSearch} size="default" disabled={isSubmitting || disabled}>
              {isSubmitting ? (
                'Mencari...'
              ) : (
                <>
                  <Search className="w-4 h-4 mr-1" />
                  Cari
                </>
              )}
            </Button>
          </div>
          {skuInput.trim().length > 0 ? (
            <div className="relative">
              <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-card shadow-sm">
                {isSearching ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Mencari...</div>
                ) : skuSuggestions.length > 0 ? (
                  skuSuggestions.map((item) => (
                    <button
                      key={item.sku}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-60"
                      onClick={() => handleSelectSuggestion(item)}
                      disabled={isSubmitting || disabled}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                      <span className="ml-2 text-foreground">{item.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Tidak ada hasil</div>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            <Select
              value={customBrandInput}
              onValueChange={setCustomBrandInput}
              disabled={disabled || isLoadingBrands || brandOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingBrands ? 'Memuat brand...' : 'Pilih brand'} />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    {isLoadingBrands ? 'Memuat brand...' : 'Brand tidak tersedia'}
                  </SelectItem>
                ) : (
                  brandOptions.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Input
              placeholder="Nama Produk"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={disabled}
            />
            <Input
              placeholder="Deskripsi"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              disabled={disabled}
            />
            <Input
              placeholder="UOM (contoh: Dus, Pcs)"
              value={uomInput}
              onChange={(e) => setUomInput(e.target.value)}
              disabled={disabled}
            />
            <Input
              placeholder="Harga Normal"
              type="number"
              min="0"
              value={normalPriceInput}
              onChange={(e) => setNormalPriceInput(e.target.value)}
              disabled={disabled}
            />
            <Input
              placeholder="Harga Final"
              type="number"
              min="0"
              value={finalPriceInput}
              onChange={(e) => setFinalPriceInput(e.target.value)}
              disabled={disabled}
            />

            {/* Price Mode Selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={priceMode === 'discount' ? 'default' : 'secondary'}
                onClick={() => setPriceMode('discount')}
                className="w-full"
                disabled={disabled}
              >
                Input Diskon
              </Button>
              <Button
                variant={priceMode === 'cut' ? 'default' : 'secondary'}
                onClick={() => setPriceMode('cut')}
                className="w-full"
                disabled={disabled}
              >
                Potongan Harga
              </Button>
            </div>

            {priceMode === 'discount' ? (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Diskon (%)"
                  type="number"
                  min="0"
                  value={baseDiscountInput}
                  onChange={(e) => setBaseDiscountInput(e.target.value)}
                  disabled={disabled}
                />
                <Input
                  placeholder="Extra Diskon (%) - Opsional"
                  type="number"
                  min="0"
                  value={extraDiscountInput}
                  onChange={(e) => setExtraDiscountInput(e.target.value)}
                  disabled={disabled}
                />
                <Input
                  placeholder="Diskon Member (%) - Opsional"
                  type="number"
                  min="0"
                  value={memberDiscountInput}
                  onChange={(e) => setMemberDiscountInput(e.target.value)}
                  disabled={disabled}
                />
                <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <Checkbox
                    checked={upToInput}
                    onCheckedChange={(checked) => setUpToInput(Boolean(checked))}
                    disabled={disabled}
                  />
                  <span>Up to</span>
                </label>
              </div>
            ) : (
              <Input
                placeholder="Potongan Harga (Rp)"
                type="number"
                min="0"
                value={priceCutInput}
                onChange={(e) => setPriceCutInput(e.target.value)}
                disabled={disabled}
              />
            )}
          </div>
          <Button onClick={handleAddCustomProduct} size="default" className="w-full" disabled={disabled}>
            <Plus className="w-4 h-4 mr-1" />
            Tambah Produk Custom
          </Button>
        </>
      )}

      {/* Product List */}
      <div className="space-y-2">
        {products.map((product) => {
          const isActive = activeSku === product.sku;
          return (
          <div
            key={product.sku}
            className={`product-card animate-fade-in transition-colors ${onSelectProduct && !disabled ? 'cursor-pointer hover:border-primary/60' : ''} ${isActive ? 'border-primary/70 ring-2 ring-primary/20' : ''}`}
            onClick={() => {
              if (disabled) return;
              onSelectProduct?.(product.sku);
            }}
            onKeyDown={(event) => {
              if (disabled) return;
              if (!onSelectProduct) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectProduct(product.sku);
              }
            }}
            role={onSelectProduct && !disabled ? 'button' : undefined}
            tabIndex={onSelectProduct && !disabled ? 0 : undefined}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {product.sku}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {product.brand ? `${product.brand} - ${product.name}` : product.name}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Harga Normal: <span className="font-semibold text-foreground">Rp {formatPrice(product.normalPrice)}</span></p>
                  <p>Harga Promo: <span className="font-semibold text-success">Rp {formatPrice(product.promoPrice)}</span></p>
                  <p>Diskon: <span className="font-semibold text-success">{product.discount}%</span></p>
                  {product.extraDiscount ? (
                    <p>Extra Diskon: <span className="font-semibold text-success">{product.extraDiscount}%</span></p>
                  ) : null}
                  {product.memberDiscount ? (
                    <p>Diskon Member: <span className="font-semibold text-success">{product.memberDiscount}%</span></p>
                  ) : null}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  if (disabled) return;
                  onRemoveProduct(product.sku);
                }}
                className="text-muted-foreground hover:text-destructive"
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
        })}
      </div>

      {/* Add Bulk Button 
      <button className="w-full py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5">
        <Plus className="w-4 h-4" />
        Tambah SKU (Bulk)
      </button>*/}
    </div>
  );
};
