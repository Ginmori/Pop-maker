import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas as FabricCanvas, Rect, FabricText, Line, Group, FabricImage, Circle, Textbox, Gradient } from 'fabric';
import { Product, formatPrice } from '@/data/products';
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
    const disc2Raw = product.disc2 ?? 0;
    const disc3Raw = product.disc3 ?? 0;
    const memberRaw = product.memberDiscount ?? 0;
    const discountAmount = product.discountAmount ?? 0;
    const hasAnyDiscount =
      baseDiscount > 0 || disc2Raw > 0 || disc3Raw > 0 || memberRaw > 0 || discountAmount > 0;

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
    currentY += 10 * groupScale;

    // Discount badge removed (center)

    const priceSize = (settings.layout === '4' ? 50 : settings.layout === '2' ? 62 : 78) * groupScale;
    const graniteLabel = `${product.descSegment || ''} ${product.description || ''}`.toUpperCase();
    const isGranite = graniteLabel.includes('GRANIT');
    const meterBase = Number(product.basePricePerMeter);
    const meterFinal = Number(product.finalPricePerMeter);
    const hasMeterPrice = Number.isFinite(meterFinal) && Number.isFinite(meterBase);

    const renderStrikePrice = (price: number, uomLabel: string | undefined, alignX: number, scale = 1) => {
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
      return strikeFontSize + 10 * groupScale;
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

    if (isGranite && hasMeterPrice) {
      const graniteBaseScale = settings.layout === '4' ? 1 : settings.layout === '2' ? 1.06 : 1.12;
      const graniteScale = hasAnyDiscount ? graniteBaseScale : graniteBaseScale * 1.12;
      const columnGap = Math.max(20 * groupScale, contentWidth * 0.1);
      const columnWidth = (contentWidth - columnGap) / 2;
      const leftCenter = centerX - (columnWidth / 2 + columnGap / 2);
      const rightCenter = centerX + (columnWidth / 2 + columnGap / 2);
      const strikeScale = graniteScale * 0.9;
      if (hasAnyDiscount) {
        const leftStrikeHeight = renderStrikePrice(product.normalPrice, product.uom, leftCenter, strikeScale);
        const rightStrikeHeight = renderStrikePrice(meterBase, 'Mtr', rightCenter, strikeScale);
        currentY += Math.max(leftStrikeHeight, rightStrikeHeight);
      }

      const leftHeight = renderPriceBlock(product.promoPrice, product.uom, leftCenter, currentY, graniteScale, columnWidth);
      const rightHeight = renderPriceBlock(meterFinal, 'Mtr', rightCenter, currentY, graniteScale, columnWidth);
      currentY += Math.max(leftHeight, rightHeight) + 10 * groupScale;
    } else {
      if (hasAnyDiscount) {
        const strikeHeight = renderStrikePrice(product.normalPrice, product.uom, centerX);
        currentY += strikeHeight;
      }

      const nonGraniteScale = hasAnyDiscount ? 1.45 : 1.65;
      const promoHeight = renderPriceBlock(product.promoPrice, product.uom, centerX, currentY, nonGraniteScale, contentWidth);
      currentY += promoHeight + 10 * groupScale;
    }

    // Bottom discount badge
    if (product.discountType === 'cut' && discountAmount > 0) {
      const rowWidth = contentWidth * 0.6;
      const rowHeight = (settings.layout === '4' ? 70 : settings.layout === '2' ? 84 : 96) * groupScale;
      const rowY = currentY + 6 * groupScale;
      const headerHeight = rowHeight * 0.42;
      const radius = 16 * groupScale;

      objects.push(new Rect({
        left: centerX - rowWidth / 2,
        top: rowY,
        width: rowWidth,
        height: rowHeight,
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

      objects.push(new FabricText('POTONGAN', {
        left: centerX,
        top: rowY + headerHeight * 0.5,
        fontSize: (settings.layout === '4' ? 12 : settings.layout === '2' ? 13 : 14) * groupScale,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '800',
        fill: '#ffffff',
        originX: 'center',
        originY: 'center',
      }));
      objects.push(new FabricText(`Rp ${formatPrice(discountAmount)}`, {
        left: centerX,
        top: rowY + headerHeight + (rowHeight - headerHeight) * 0.62,
        fontSize: (settings.layout === '4' ? 26 : settings.layout === '2' ? 31 : 38) * groupScale,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '800',
        fill: '#4b5563',
        originX: 'center',
        originY: 'center',
      }));
    } else if (product.discountType !== 'cut' && (baseDiscount > 0 || disc2Raw > 0 || disc3Raw > 0 || memberRaw > 0)) {
      const baseValue = Math.round(baseDiscount);
      const disc2Value = Math.round(disc2Raw);
      const disc3Value = Math.round(disc3Raw);
      const member = Math.round(memberRaw);
      const discountParts = [baseValue, disc2Value, disc3Value].filter((value) => value > 0);
      const discountValue = discountParts.map((value) => `${value}%`).join(' + ');
      const items = [
        discountParts.length > 0 ? { label: 'DISKON', value: discountValue, colors: ['#ef4444', '#ef4444'] } : null,
        member > 0 ? { label: 'MEMBER', value: `${member}%`, colors: ['#1d4ed8', '#60a5fa'] } : null,
      ].filter(Boolean) as { label: string; value: string; colors: [string, string] }[];

      if (items.length === 0) {
        return new Group(objects);
      }

      const labelFontSize = (settings.layout === '4' ? 12 : settings.layout === '2' ? 13 : 14) * groupScale;
      const valueFontSize = (settings.layout === '4' ? 26 : settings.layout === '2' ? 31 : 38) * groupScale;
      let rowWidth = items.length === 1 ? contentWidth * 0.4 : contentWidth;
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
      const rowY = currentY + 6 * groupScale;
      const headerHeight = rowHeight * 0.42;
      const radius = 16 * groupScale;

      objects.push(new Rect({
        left: centerX - rowWidth / 2,
        top: rowY,
        width: rowWidth,
        height: rowHeight,
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

        objects.push(new Rect({
          left: cellX,
          top: rowY,
          width: cellWidth,
          height: rowHeight,
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
          fontSize: labelFontSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          fill: '#ffffff',
          originX: 'center',
          originY: 'center',
        }));
        objects.push(new FabricText(item.value, {
          left: cellX + cellWidth / 2,
          top: rowY + headerHeight + (rowHeight - headerHeight) * 0.62,
          fontSize: valueFontSize,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          fill: items.length > 1 ? '#4b5563' : '#dc2626',
          originX: 'center',
          originY: 'center',
        }));

        if (items.length > 1 && index > 0) {
          objects.push(new Line([cellX, rowY + 6, cellX, rowY + rowHeight - 6], {
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
  }, [drawPOPItem, selectedTemplateData, settings]);

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
              settings={settings}
              selectedTemplateData={selectedTemplateData}
              drawPOPItem={drawPOPItem}
              renderPageCanvas={renderPageCanvas}
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
}

const PageCanvas = ({ product, renderPageCanvas }: PageCanvasProps) => {
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

  return <canvas ref={canvasRef} />;
};
