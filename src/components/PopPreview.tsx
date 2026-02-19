import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas as FabricCanvas, Rect, FabricText, Line, Group, FabricImage, Circle, Textbox, Gradient } from 'fabric';
import { Product, CustomPriceOption, formatPrice } from '@/data/products';
import { Template } from '@/data/templates';
import { PopSettingsState } from './PopSettings';
import { Minus, Plus, ChevronUp } from 'lucide-react';

interface PopPreviewProps {
  products: Product[];
  settings: PopSettingsState;
  selectedTemplateData: Template;
  previewScale: number;
  onScaleChange: (scale: number) => void;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export interface PopPreviewHandle {
  getPageImages: () => Promise<string[]>;
}

interface PopItemTransform {
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
}

// A4 dimensions at 72 DPI
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

// Scale factor for high-resolution PDF/Print export (3x = 216 DPI)
export const PRINT_SCALE = 3;

export const PopPreview = forwardRef<PopPreviewHandle, PopPreviewProps>(({
  products,
  settings,
  selectedTemplateData,
  previewScale,
  onScaleChange,
  activeIndex,
  onActiveIndexChange,
}, ref) => {
  const zoomIn = () => onScaleChange(Math.min(previewScale + 0.25, 2));
  const zoomOut = () => onScaleChange(Math.max(previewScale - 0.25, 0.5));
  const resetZoom = () => onScaleChange(1);
  const [itemTransforms, setItemTransforms] = useState<Record<string, PopItemTransform>>({});

  const drawBarcode = useCallback((x: number, y: number, width: number, code: string): Group => {
    const barWidth = width / 40;
    const barHeight = 40;
    const objects: (Rect | FabricText)[] = [];

    for (let i = 0; i < 35; i++) {
      const isBar = Math.random() > 0.4;
      if (isBar) {
        objects.push(new Rect({
          left: x + i * barWidth,
          top: y,
          width: barWidth * 0.8,
          height: barHeight,
          fill: '#000000',
        }));
      }
    }

    return new Group(objects);
  }, []);

  const drawPOPItem = useCallback(async (
    product: Product,
    x: number,
    y: number,
    itemWidth: number,
    itemHeight: number,
    settings: PopSettingsState,
    hasCustomTemplate: boolean = false
  ): Promise<Group> => {
    const objects: (Rect | FabricText | Line | Group | FabricImage | Circle)[] = [];
    const centerX = x + itemWidth / 2;
    const baseScale = 1.05;
    const groupScale = (settings.layout === '4' ? 1.1 : settings.layout === '2' ? 1.16 : 1.22) * baseScale;
    const startY = y + itemHeight * 0.3;
    let currentY = startY;
    const contentWidth = itemWidth * (settings.layout === '4' ? 0.74 : settings.layout === '2' ? 0.84 : 0.88);
    const fitTextToLines = (text: string, maxLines: number, box: Textbox, baseSize: number) => {
      const measureLines = () =>
        (box.textLines ?? (box as { _textLines?: string[] })._textLines ?? []).length;

      box.set({ text, fontSize: baseSize });
      box.initDimensions();
      if (measureLines() <= maxLines) return;

      let size = baseSize;
      const minSize = Math.max(12, baseSize * 0.7);
      while (size > minSize) {
        size -= 1;
        box.set({ fontSize: size });
        box.initDimensions();
        if (measureLines() <= maxLines) return;
      }
    };
    const fitTextToWidth = (text: string, maxWidth: number, baseSize: number, minSize: number) => {
      const measure = (size: number) => {
        const temp = new FabricText(text, {
          fontSize: size,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '700',
        });
        return temp.getScaledWidth?.() ?? temp.width ?? 0;
      };

      let size = baseSize;
      while (size > minSize && measure(size) > maxWidth) {
        size -= 1;
      }
      return size;
    };

    // Background (only for default templates)
    if (!hasCustomTemplate) {
      objects.push(new Rect({
        left: x,
        top: y,
        width: itemWidth,
        height: itemHeight,
        fill: '#ffffff',
        stroke: '#e5e7eb',
        strokeWidth: 1,
      }));
    }

    // Brand (optional) without logo badge
    const brandLabel = product.brandSegment || product.brand;
    if (brandLabel) {
      const brandSize = (settings.layout === '4' ? 36 : settings.layout === '2' ? 39 : 42) * groupScale;
      const brandFontSize = fitTextToWidth(
        brandLabel,
        contentWidth,
        brandSize,
        Math.max(14, brandSize * 0.65)
      );

      objects.push(new FabricText(brandLabel, {
        left: centerX,
        top: currentY,
        fontSize: brandFontSize,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: '#374151',
        originX: 'center',
        originY: 'center',
      }));
      currentY += brandFontSize + 10 * groupScale;
    }

    const baseDiscount = product.discount ?? 0;
    const disc2Raw = product.extraDiscount ?? product.disc2 ?? 0;
    const disc3Raw = product.disc3 ?? 0;
    const rawDisc4 = product.memberDiscount ?? 0;
    const isDisc4MemberValue = rawDisc4 === 2 || rawDisc4 === 3;
    const useDisc4AsMember = product.isCustom ? rawDisc4 > 0 : isDisc4MemberValue;
    const memberRaw = useDisc4AsMember ? rawDisc4 : 0;
    const disc4AsDiscountRaw = useDisc4AsMember ? 0 : rawDisc4;
    const discountAmount = product.discountAmount ?? 0;
    const priceRows: CustomPriceOption[] = (
      product.customPriceOptions && product.customPriceOptions.length > 0
        ? product.customPriceOptions
        : [{ uom: product.uom, normalPrice: product.normalPrice, promoPrice: product.promoPrice }]
    ).filter((row) => (row.normalPrice ?? 0) > 0 || (row.promoPrice ?? 0) > 0);
    const primaryPrice = priceRows[0] ?? {
      uom: product.uom,
      normalPrice: product.normalPrice,
      promoPrice: product.promoPrice,
    };
    const hasAnyDiscount =
      baseDiscount > 0 || disc2Raw > 0 || disc3Raw > 0 || disc4AsDiscountRaw > 0 || memberRaw > 0 || discountAmount > 0;
    const hasNoPrice = priceRows.length === 0;
    const isDiscountOnly = hasAnyDiscount && hasNoPrice;

    // Product Name
    const nameBaseSize = (settings.layout === '4' ? 11 : settings.layout === '2' ? 15 : 19) * groupScale;
    const nameSize = hasAnyDiscount ? nameBaseSize : nameBaseSize * 1.15;
    const nameBox = new Textbox(product.name, {
      left: centerX,
      top: currentY,
      width: contentWidth,
      fontSize: nameSize,
      fontFamily: 'Inter, sans-serif',
      fontWeight: '700',
      fill: '#111827',
      textAlign: 'center',
      originX: 'center',
      originY: 'top',
    });
    fitTextToLines(product.name, hasAnyDiscount ? 1 : 2, nameBox, nameSize);
    objects.push(nameBox);
    const nameHeight = Math.max(nameSize, nameBox.getScaledHeight?.() ?? nameBox.height ?? nameSize);
    currentY += nameHeight + 6 * groupScale;

    // Description (optional)
    const descText = product.descSegment || product.description;
    if (descText) {
      const descSize = (settings.layout === '4' ? 12 : settings.layout === '2' ? 14 : 16) * groupScale;
      const descBox = new Textbox(descText, {
        left: centerX,
        top: currentY,
        width: contentWidth,
        fontSize: descSize,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '500',
        fill: '#6b7280',
        textAlign: 'center',
        originX: 'center',
        originY: 'top',
      });
      objects.push(descBox);
      const descHeight = Math.max(descSize, descBox.getScaledHeight?.() ?? descBox.height ?? descSize);
      currentY += descHeight + 10 * groupScale;
    } else {
      currentY += 6 * groupScale;
    }

    // Divider
    const dividerWidth = contentWidth * 0.9;
    objects.push(new Line(
      [centerX - dividerWidth / 2, currentY, centerX + dividerWidth / 2, currentY],
      { stroke: '#e5e7eb', strokeWidth: 1 },
    ));
    currentY += (priceRows.length > 1 ? 4 : 10) * groupScale;

    // Discount badge removed (center)

    const priceSize = (settings.layout === '4' ? 50 : settings.layout === '2' ? 62 : 78) * groupScale;
    const graniteLabel = `${product.descSegment || ''} ${product.description || ''}`.toUpperCase();
    const isGranite = graniteLabel.includes('GRANIT');
    const meterBase = Number(product.basePricePerMeter);
    const meterFinal = Number(product.finalPricePerMeter);
    const hasMeterPrice = Number.isFinite(meterFinal) && Number.isFinite(meterBase);

    const renderStrikePrice = (
      price: number,
      uomLabel: string | undefined,
      alignX: number,
      scale = 1,
      gapScale = 1
    ) => {
      if (!settings.showStrikePrice || !price) return 0;
      const strikeFontSize = (settings.layout === '4' ? 18 : settings.layout === '2' ? 20 : 22) * groupScale * scale;
      const strikeText = new FabricText(`Rp ${formatPrice(price)}`, {
        left: alignX,
        top: currentY,
        fontSize: strikeFontSize,
        fontFamily: 'Inter, sans-serif',
        fill: '#dc2626',
        originX: 'center',
        originY: 'top',
      });
      objects.push(strikeText);
      const strikeWidth = strikeText.getScaledWidth?.() ?? strikeText.width ?? 0;
      if (uomLabel) {
        objects.push(new FabricText(`/${uomLabel}`, {
          left: alignX + strikeWidth / 2 + 6 * groupScale,
          top: currentY + strikeFontSize * 0.1,
          fontSize: Math.max(10, strikeFontSize * 0.7),
          fontFamily: 'Inter, sans-serif',
          fontWeight: '600',
          fill: '#6b7280',
          originX: 'left',
          originY: 'top',
        }));
      }

      const lineWidth = strikeWidth + (uomLabel ? 18 * groupScale * scale : 0);
      objects.push(new Line([alignX - lineWidth / 2, currentY + strikeFontSize / 2, alignX + lineWidth / 2, currentY + strikeFontSize / 2], {
        stroke: '#dc2626',
        strokeWidth: 2,
      }));
      return strikeFontSize + 10 * groupScale * gapScale;
    };

    const renderPriceBlock = (
      price: number,
      uomLabel: string | undefined,
      alignX: number,
      topY: number,
      scale = 1,
      maxWidth?: number
    ) => {
      const formattedPrice = formatPrice(price);
      const splitIndex = formattedPrice.lastIndexOf('.');
      const mainPrice = splitIndex > -1 ? formattedPrice.slice(0, splitIndex) : formattedPrice;
      const tailDigits = splitIndex > -1 ? formattedPrice.slice(splitIndex + 1) : '';

      const measureWidth = (sizeScale: number) => {
        const localPrice = priceSize * sizeScale;
        const localCurrency = Math.max(12, localPrice * 0.4);
        const localUomSize = Math.max(10, localPrice * 0.22);
        const gapMain = 6 * groupScale * sizeScale;
        const gapTail = tailDigits ? 4 * groupScale * sizeScale : 0;
        const currencyMeasure = new FabricText('Rp.', {
          fontSize: localCurrency,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '700',
        });
        const promoMeasure = new FabricText(mainPrice, {
          fontSize: localPrice,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '900',
        });
        const tailMeasure = tailDigits
          ? new FabricText(`.${tailDigits}`, {
            fontSize: Math.max(10, localPrice * 0.35),
            fontFamily: 'Inter, sans-serif',
            fontWeight: '800',
          })
          : null;
        const uomMeasure = uomLabel
          ? new FabricText(`/${uomLabel}`, {
            fontSize: localUomSize,
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600',
          })
          : null;

        const currencyWidth = currencyMeasure.getScaledWidth?.() ?? currencyMeasure.width ?? 0;
        const promoWidth = promoMeasure.getScaledWidth?.() ?? promoMeasure.width ?? 0;
        const tailWidth = tailMeasure?.getScaledWidth?.() ?? tailMeasure?.width ?? 0;
        const uomWidth = uomMeasure?.getScaledWidth?.() ?? uomMeasure?.width ?? 0;
        const rightWidth = Math.max(tailWidth, uomWidth);
        return currencyWidth + gapMain + promoWidth + gapTail + rightWidth;
      };

      let sizeScale = scale;
      if (maxWidth) {
        const minScale = 0.6;
        while (sizeScale > minScale && measureWidth(sizeScale) > maxWidth) {
          sizeScale = Math.max(minScale, sizeScale - 0.04);
        }
      }

      const localPriceSize = priceSize * sizeScale;
      const localCurrencySize = Math.max(12, localPriceSize * 0.4);

      const currencyText = new FabricText('Rp.', {
        left: alignX,
        top: topY + localPriceSize * 0.12,
        fontSize: localCurrencySize,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: '#0284c7',
        originX: 'left',
        originY: 'top',
      });
      const currencyWidth = currencyText.getScaledWidth?.() ?? currencyText.width ?? 0;

      const promoText = new FabricText(mainPrice, {
        left: alignX,
        top: topY,
        fontSize: localPriceSize,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '900',
        fill: '#0284c7',
        originX: 'left',
        originY: 'top',
      });
      const promoWidth = promoText.getScaledWidth?.() ?? promoText.width ?? 0;

      let tailTop = topY;
      let tailHeight = 0;
      let tailWidth = 0;
      let tailText: FabricText | null = null;
      if (tailDigits) {
        const tailSize = Math.max(10, localPriceSize * 0.35);
        tailText = new FabricText(`.${tailDigits}`, {
          left: alignX,
          top: topY + localPriceSize * 0.08,
          fontSize: tailSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          fill: '#0284c7',
          originX: 'left',
          originY: 'top',
        });
        tailTop = tailText.top ?? tailTop;
        tailHeight = tailText.getScaledHeight?.() ?? tailText.height ?? tailSize;
        tailWidth = tailText.getScaledWidth?.() ?? tailText.width ?? 0;
      }

      const gapMain = 6 * groupScale * sizeScale;
      const gapTail = tailDigits ? 4 * groupScale * sizeScale : 0;
      const totalWidth = currencyWidth + gapMain + promoWidth + gapTail + (tailDigits ? tailWidth : 0);
      const startX = alignX - totalWidth / 2;

      currencyText.set({ left: startX });
      promoText.set({ left: startX + currencyWidth + gapMain });
      if (tailText) {
        tailText.set({ left: startX + currencyWidth + gapMain + promoWidth + gapTail });
      }

      objects.push(currencyText);
      objects.push(promoText);
      if (tailText) {
        objects.push(tailText);
      }

      if (uomLabel) {
        const uomSize = Math.max(10, localPriceSize * 0.22);
        const uomLeft = startX + currencyWidth + gapMain + promoWidth + gapTail;
        const uomTop = tailDigits ? tailTop + tailHeight + 1 * groupScale : topY + localPriceSize * 0.35;
        objects.push(new FabricText(`/${uomLabel}`, {
          left: uomLeft,
          top: uomTop,
          fontSize: uomSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '600',
          fill: '#0284c7',
          originX: 'left',
          originY: 'top',
        }));
      }

      const promoHeight = promoText.getScaledHeight?.() ?? promoText.height ?? localPriceSize;
      return Math.max(promoHeight, tailTop - topY + tailHeight);
    };

    if (!isDiscountOnly && isGranite && hasMeterPrice && priceRows.length <= 1) {
      const graniteBaseScale = settings.layout === '4' ? 1 : settings.layout === '2' ? 1.06 : 1.12;
      const graniteScale = hasAnyDiscount ? graniteBaseScale : graniteBaseScale * 1.12;
      const columnGap = Math.max(20 * groupScale, contentWidth * 0.1);
      const columnWidth = (contentWidth - columnGap) / 2;
      const leftCenter = centerX - (columnWidth / 2 + columnGap / 2);
      const rightCenter = centerX + (columnWidth / 2 + columnGap / 2);
      const strikeScale = graniteScale * 0.9;
      if (hasAnyDiscount) {
        const leftStrikeHeight = renderStrikePrice(primaryPrice.normalPrice, primaryPrice.uom, leftCenter, strikeScale);
        const rightStrikeHeight = renderStrikePrice(meterBase, 'Mtr', rightCenter, strikeScale);
        currentY += Math.max(leftStrikeHeight, rightStrikeHeight);
      }

      const leftHeight = renderPriceBlock(primaryPrice.promoPrice, primaryPrice.uom, leftCenter, currentY, graniteScale, columnWidth);
      const rightHeight = renderPriceBlock(meterFinal, 'Mtr', rightCenter, currentY, graniteScale, columnWidth);
      currentY += Math.max(leftHeight, rightHeight) + 10 * groupScale;
    } else if (!isDiscountOnly) {
      if (priceRows.length > 1) {
        const rowScale = priceRows.length >= 3 ? 0.58 : 0.72;
        const strikeScale = rowScale * 0.48;
        const rowGap = 3 * groupScale;
        const separatorGap = 3 * groupScale;
        priceRows.forEach((row, index) => {
          const effectivePromo = row.promoPrice > 0 ? row.promoPrice : row.normalPrice;
          const hasStrike = settings.showStrikePrice && row.normalPrice > 0 && row.normalPrice > effectivePromo;
          if (hasStrike) {
            const strikeHeight = renderStrikePrice(row.normalPrice, row.uom, centerX, strikeScale, 0.4);
            currentY += strikeHeight;
          }
          const promoHeight = renderPriceBlock(
            effectivePromo,
            row.uom,
            centerX,
            currentY,
            rowScale,
            contentWidth * 0.9
          );
          currentY += promoHeight + rowGap;
          if (index < priceRows.length - 1) {
            const separatorWidth = contentWidth * 0.86;
            objects.push(new Line(
              [centerX - separatorWidth / 2, currentY, centerX + separatorWidth / 2, currentY],
              { stroke: '#e5e7eb', strokeWidth: 1 },
            ));
            currentY += separatorGap;
          }
        });
      } else {
        if (hasAnyDiscount) {
          const strikeHeight = renderStrikePrice(primaryPrice.normalPrice, primaryPrice.uom, centerX);
          currentY += strikeHeight;
        }

        const nonGraniteScale = hasAnyDiscount ? 1.45 : 1.65;
        const promoHeight = renderPriceBlock(primaryPrice.promoPrice, primaryPrice.uom, centerX, currentY, nonGraniteScale, contentWidth);
        currentY += promoHeight + 10 * groupScale;
      }
    }

    // Bottom discount badge
    const cutValue =
      product.discountType === 'cut'
        ? discountAmount
        : baseDiscount > 100
          ? baseDiscount
          : 0;
    if (cutValue > 0) {
      const rowWidth = isDiscountOnly ? contentWidth : contentWidth * 0.6;
      const rowHeight = (settings.layout === '4' ? 70 : settings.layout === '2' ? 84 : 96) * groupScale;
      const heightScale = isDiscountOnly ? 1.6 : 1;
      const headerRatio = isDiscountOnly ? 0.28 : 0.42;
      const rowY = currentY + 6 * groupScale;
      const headerHeight = rowHeight * headerRatio * heightScale;
      const radius = 16 * groupScale;

      objects.push(new Rect({
        left: centerX - rowWidth / 2,
        top: rowY,
        width: rowWidth,
        height: rowHeight * heightScale,
        fill: '#f8fafc',
        stroke: '#d1d5db',
        strokeWidth: 1,
        rx: radius,
        ry: radius,
        shadow: { color: 'rgba(15, 23, 42, 0.15)', blur: 6, offsetX: 0, offsetY: 2 },
      }));

      const gradient = new Gradient({
        type: 'linear',
        coords: { x1: centerX - rowWidth / 2, y1: rowY, x2: centerX + rowWidth / 2, y2: rowY },
        colorStops: [
          { offset: 0, color: '#ef4444' },
          { offset: 1, color: '#ef4444' },
        ],
      });

      objects.push(new Rect({
        left: centerX - rowWidth / 2,
        top: rowY,
        width: rowWidth,
        height: headerHeight,
        fill: gradient,
        rx: radius,
        ry: radius,
      }));

      objects.push(new FabricText('POTONGAN HARGA', {
        left: centerX,
        top: rowY + headerHeight * 0.5,
        fontSize: (settings.layout === '4' ? 12 : settings.layout === '2' ? 13 : 14) * groupScale * (isDiscountOnly ? 1.4 : 1),
        fontFamily: 'Inter, sans-serif',
        fontWeight: '800',
        fill: '#ffffff',
        originX: 'center',
        originY: 'center',
      }));
      objects.push(new FabricText(`Rp ${formatPrice(cutValue)}`, {
        left: centerX,
        top: rowY + headerHeight + (rowHeight * heightScale - headerHeight) * 0.55,
        fontSize: (settings.layout === '4' ? 26 : settings.layout === '2' ? 31 : 38) * groupScale * (isDiscountOnly ? 1.8 : 1),
        fontFamily: 'Inter, sans-serif',
        fontWeight: '800',
        fill: '#4b5563',
        originX: 'center',
        originY: 'center',
      }));
    } else if (baseDiscount > 0 || disc2Raw > 0 || disc3Raw > 0 || disc4AsDiscountRaw > 0 || memberRaw > 0) {
      const fitFontSizeToWidth = (text: string, initialSize: number, maxWidth: number, minSize: number) => {
        let size = initialSize;
        while (size > minSize) {
          const metrics = new FabricText(text, {
            fontSize: size,
            fontFamily: 'Inter, sans-serif',
            fontWeight: '800',
          });
          const width = metrics.getScaledWidth?.() ?? metrics.width ?? 0;
          if (width <= maxWidth) return size;
          size -= 1;
        }
        return minSize;
      };

      const formatPercentValue = (value: number) => {
        const fixed = value.toFixed(2);
        return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
      };
      const baseValue = baseDiscount;
      const disc2Value = disc2Raw;
      const disc3Value = disc3Raw;
      const disc4AsDiscountValue = disc4AsDiscountRaw;
      const member = memberRaw;
      const discountParts = [baseValue, disc2Value, disc3Value, disc4AsDiscountValue].filter((value) => value > 0);
      const discountValue = discountParts.map((value) => `${formatPercentValue(value)}%`).join(' + ');
      const discountLabel = product.upTo ? 'DISKON UP TO' : 'DISKON';
      const items = [
        discountParts.length > 0 ? { label: discountLabel, value: discountValue, colors: ['#ef4444', '#ef4444'] } : null,
        member > 0 ? { label: 'MEMBER', value: `${formatPercentValue(member)}%`, colors: ['#1d4ed8', '#60a5fa'] } : null,
      ].filter(Boolean) as { label: string; value: string; colors: [string, string] }[];

      if (items.length === 0) {
        return new Group(objects);
      }

      const labelFontSize = (settings.layout === '4' ? 12 : settings.layout === '2' ? 13 : 14) * groupScale * (isDiscountOnly ? 1.7 : 1);
      const valueFontSize = (settings.layout === '4' ? 26 : settings.layout === '2' ? 31 : 38) * groupScale * (isDiscountOnly ? 2.2 : 1);
      let rowWidth = items.length === 1 ? contentWidth * 0.4 : contentWidth;
      if (isDiscountOnly) {
        rowWidth = contentWidth;
      }
      if (items.length === 1) {
        const labelMetrics = new FabricText(items[0].label, {
          fontSize: labelFontSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
        });
        const valueMetrics = new FabricText(items[0].value, {
          fontSize: valueFontSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
        });
        const labelWidth = labelMetrics.getScaledWidth?.() ?? labelMetrics.width ?? 0;
        const valueWidth = valueMetrics.getScaledWidth?.() ?? valueMetrics.width ?? 0;
        const textWidth = Math.max(labelWidth, valueWidth);
        const minWidth = contentWidth * 0.4;
        const maxWidth = contentWidth;
        rowWidth = Math.min(maxWidth, Math.max(minWidth, textWidth + 36 * groupScale));
      }
      const rowHeight = (settings.layout === '4' ? 70 : settings.layout === '2' ? 84 : 96) * groupScale;
      const heightScale = isDiscountOnly ? 2 : 1;
      const headerRatio = isDiscountOnly ? 0.3 : 0.42;
      const rowY = currentY + 6 * groupScale;
      const headerHeight = rowHeight * headerRatio * heightScale;
      const radius = 16 * groupScale;

      objects.push(new Rect({
        left: centerX - rowWidth / 2,
        top: rowY,
        width: rowWidth,
        height: rowHeight * heightScale,
        fill: '#f8fafc',
        stroke: '#d1d5db',
        strokeWidth: 1,
        rx: radius,
        ry: radius,
        shadow: { color: 'rgba(15, 23, 42, 0.15)', blur: 6, offsetX: 0, offsetY: 2 },
      }));

      const cellWidth = rowWidth / items.length;

      items.forEach((item, index) => {
        const cellX = centerX - rowWidth / 2 + cellWidth * index;
        const textMaxWidth = Math.max(40, cellWidth - 24 * groupScale);
        const dynamicLabelSize = fitFontSizeToWidth(
          item.label,
          labelFontSize,
          textMaxWidth,
          Math.max(10, labelFontSize * 0.7)
        );
        const dynamicValueSize = fitFontSizeToWidth(
          item.value,
          valueFontSize,
          textMaxWidth,
          Math.max(16, valueFontSize * 0.5)
        );

        objects.push(new Rect({
          left: cellX,
          top: rowY,
          width: cellWidth,
          height: rowHeight * heightScale,
          fill: '#f8fafc',
          stroke: '#d1d5db',
          strokeWidth: 1,
          rx: radius,
          ry: radius,
        }));

        const gradient = new Gradient({
          type: 'linear',
          coords: { x1: cellX, y1: rowY, x2: cellX + cellWidth, y2: rowY },
          colorStops: [
            { offset: 0, color: item.colors[0] },
            { offset: 1, color: item.colors[1] },
          ],
        });

        objects.push(new Rect({
          left: cellX,
          top: rowY,
          width: cellWidth,
          height: headerHeight,
          fill: gradient,
          rx: radius,
          ry: radius,
        }));

        objects.push(new FabricText(item.label, {
          left: cellX + cellWidth / 2,
          top: rowY + headerHeight * 0.5,
          fontSize: dynamicLabelSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          fill: '#ffffff',
          originX: 'center',
          originY: 'center',
        }));
        objects.push(new FabricText(item.value, {
          left: cellX + cellWidth / 2,
          top: rowY + headerHeight + (rowHeight * heightScale - headerHeight) * 0.55,
          fontSize: dynamicValueSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          fill: items.length > 1 ? '#4b5563' : '#dc2626',
          originX: 'center',
          originY: 'center',
        }));

        if (items.length > 1 && index > 0) {
          objects.push(new Line([cellX, rowY + 6, cellX, rowY + rowHeight * heightScale - 6], {
            stroke: '#e5e7eb',
            strokeWidth: 1,
          }));
        }
      });
    }

    return new Group(objects);
  }, [drawBarcode]);

  const totalPages = Math.max(products.length, 1);
  const [internalPage, setInternalPage] = useState(0);
  const currentPage = activeIndex ?? internalPage;
  const setPage = useCallback((nextPage: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, nextPage));
    if (onActiveIndexChange) {
      onActiveIndexChange(clamped);
    } else {
      setInternalPage(clamped);
    }
  }, [onActiveIndexChange, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, setPage, totalPages]);

  const renderPageCanvas = useCallback(async (
    canvas: FabricCanvas,
    product: Product | undefined
  ) => {
    canvas.clear();
    canvas.backgroundColor = '#ffffff';

    const cols = 1;
    const rows = 1;
    const itemWidth = A4_WIDTH / cols;
    const itemHeight = A4_HEIGHT / rows;

    const renderDefaultCanvas = async () => {
      if (!product) {
        canvas.renderAll();
        return;
      }

      const popGroup = await drawPOPItem(product, 0, 0, itemWidth, itemHeight, settings, false);
      const savedTransform = itemTransforms[product.sku];
      if (savedTransform) {
        popGroup.set(savedTransform);
        popGroup.setCoords();
      }
      canvas.add(popGroup);
      canvas.renderAll();
    };

    if (selectedTemplateData.type === 'custom' && selectedTemplateData.imageUrl) {
      try {
        const img = await FabricImage.fromURL(selectedTemplateData.imageUrl);
        img.scaleToWidth(A4_WIDTH);
        img.scaleToHeight(A4_HEIGHT);
        img.set({ left: 0, top: 0, selectable: false });
        canvas.add(img);
        canvas.sendObjectToBack(img);

        if (product) {
          const popGroup = await drawPOPItem(product, 0, 0, itemWidth, itemHeight, settings, true);
          const savedTransform = itemTransforms[product.sku];
          if (savedTransform) {
            popGroup.set(savedTransform);
            popGroup.setCoords();
          }
          canvas.add(popGroup);
        }

        canvas.renderAll();
      } catch (err) {
        console.error('Failed to load template image:', err);
        await renderDefaultCanvas();
      }
    } else {
      await renderDefaultCanvas();
    }
  }, [drawPOPItem, itemTransforms, selectedTemplateData, settings]);

  useImperativeHandle(ref, () => ({
    getPageImages: async () => {
      const images: string[] = [];
      for (let index = 0; index < totalPages; index++) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = A4_WIDTH * PRINT_SCALE;
        tempCanvas.height = A4_HEIGHT * PRINT_SCALE;
        const canvas = new FabricCanvas(tempCanvas, {
          width: A4_WIDTH * PRINT_SCALE,
          height: A4_HEIGHT * PRINT_SCALE,
          backgroundColor: '#ffffff',
          selection: false,
        });
        canvas.setZoom(PRINT_SCALE);

        await renderPageCanvas(canvas, products[index]);
        images.push(canvas.toDataURL({ format: 'png' }));
        canvas.dispose();
      }
      return images;
    },
  }), [products, renderPageCanvas, totalPages]);

  return (
    <div className="flex flex-col h-full">
      <h3 className="section-title mb-4">Preview</h3>

      {/* Preview Container */}
      <div className="flex-1 flex items-center justify-center bg-muted/50 rounded-lg p-4 overflow-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="text-xs text-muted-foreground">
            Page {currentPage + 1}/{totalPages}
          </div>
          <div
            className="a4-preview rounded"
            style={{
              transform: `scale(${previewScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}
          >
            <PageCanvas
              product={products[currentPage]}
              renderPageCanvas={renderPageCanvas}
              onTransformChange={(sku, transform) => {
                setItemTransforms((prev) => ({ ...prev, [sku]: transform }));
              }}
            />
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                className="px-3 py-1 rounded border border-border disabled:opacity-50"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
            >
              Prev
            </button>
            <button
              className="px-3 py-1 rounded border border-border disabled:opacity-50"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="flex justify-center mt-4">
        <div className="zoom-control">
          <button onClick={zoomOut} className="zoom-btn">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={resetZoom} className="px-4 py-2 text-sm font-medium min-w-[80px]">
            {Math.round(previewScale * 100)}%
          </button>
          <div className="w-px h-6 bg-border" />
          <button onClick={resetZoom} className="zoom-btn">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={zoomIn} className="zoom-btn">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

PopPreview.displayName = 'PopPreview';

interface PageCanvasProps {
  product: Product | undefined;
  renderPageCanvas: (canvas: FabricCanvas, product: Product | undefined) => Promise<void>;
  onTransformChange: (sku: string, transform: PopItemTransform) => void;
}

const PageCanvas = ({ product, renderPageCanvas, onTransformChange }: PageCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

  const renderCanvas = useCallback(async () => {
    if (!fabricCanvas) return;
    await renderPageCanvas(fabricCanvas, product);
  }, [fabricCanvas, product, renderPageCanvas]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: A4_WIDTH,
      height: A4_HEIGHT,
      backgroundColor: '#ffffff',
      selection: false,
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    if (!fabricCanvas || !product) return;
    const handleObjectModified = (event: { target?: Group }) => {
      const target = event.target;
      if (!target) return;
      onTransformChange(product.sku, {
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
      });
    };

    fabricCanvas.on('object:modified', handleObjectModified);
    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
    };
  }, [fabricCanvas, onTransformChange, product]);

  return <canvas ref={canvasRef} />;
};
