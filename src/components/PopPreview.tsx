import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas as FabricCanvas, Rect, FabricText, Line, Group, FabricImage, Circle, Textbox } from 'fabric';
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
    const baseScale = 1.01;
    const groupScale = (settings.layout === '4' ? 1.06 : settings.layout === '2' ? 1.1 : 1.15) * baseScale;
    const startY = y + itemHeight * 0.3;
    let currentY = startY;
    const contentWidth = itemWidth * (settings.layout === '4' ? 0.74 : 0.8);

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

    // Brand (optional) with logo badge
    if (product.brand) {
      const logoRadius = (settings.layout === '4' ? 16 : settings.layout === '2' ? 20 : 24) * groupScale;
      const brandSize = (settings.layout === '4' ? 14 : settings.layout === '2' ? 16 : 18) * groupScale;

      if (product.brandLogoUrl) {
        try {
          const logoImg = await FabricImage.fromURL(product.brandLogoUrl);
          logoImg.scaleToHeight(logoRadius * 2);
          logoImg.set({
            left: centerX,
            top: currentY,
            originX: 'center',
            originY: 'center',
            selectable: false,
          });
          objects.push(logoImg);
        } catch {
          // Fallback handled below
        }
      }

      if (!product.brandLogoUrl) {
        const logoBg = product.brandColor || '#0ea5e9';
        const logoTextColor = product.brandTextColor || '#ffffff';
        const logoText = (product.brandLogoText || product.brand?.[0] || '?').toUpperCase();

        objects.push(new Circle({
          left: centerX,
          top: currentY,
          radius: logoRadius,
          fill: logoBg,
          originX: 'center',
          originY: 'center',
        }));

        objects.push(new FabricText(logoText, {
          left: centerX,
          top: currentY,
          fontSize: logoRadius,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          fill: logoTextColor,
          originX: 'center',
          originY: 'center',
        }));
      }

      currentY += logoRadius * 2 + 6 * groupScale;

      objects.push(new FabricText(product.brand, {
        left: centerX,
        top: currentY,
        fontSize: brandSize,
        fontFamily: 'Inter, sans-serif',
        fontWeight: '700',
        fill: '#374151',
        originX: 'center',
        originY: 'center',
      }));
      currentY += brandSize + 10 * groupScale;
    }

    // Product Name
    const nameSize = (settings.layout === '4' ? 20 : settings.layout === '2' ? 24 : 30) * groupScale;
    const nameBox = new Textbox(product.name, {
      left: centerX,
      top: currentY,
      width: contentWidth,
      fontSize: nameSize,
      fontFamily: 'Inter, sans-serif',
      fontWeight: '700',
      fill: '#1f2937',
      textAlign: 'center',
      originX: 'center',
      originY: 'top',
    });
    objects.push(nameBox);
    const nameHeight = Math.max(nameSize, nameBox.getScaledHeight?.() ?? nameBox.height ?? nameSize);
    currentY += nameHeight + 6 * groupScale;

    // Description (optional)
    if (product.description) {
      const descSize = (settings.layout === '4' ? 12 : settings.layout === '2' ? 14 : 16) * groupScale;
      const descBox = new Textbox(product.description, {
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

    // Discount/Potongan badge
    const badgeHeight = (settings.layout === '4' ? 26 : settings.layout === '2' ? 32 : 38) * groupScale;
    const badgeFont = (settings.layout === '4' ? 13 : settings.layout === '2' ? 15 : 18) * groupScale;
    const badgeText = product.discountType === 'cut' && product.discountAmount
      ? `Potongan Rp ${formatPrice(product.discountAmount)}`
      : `Diskon ${product.discount}%`;
    const badgeWidth = Math.min(contentWidth, Math.max(120, badgeText.length * (badgeFont * 0.6)));

    objects.push(new Rect({
      left: centerX - badgeWidth / 2,
      top: currentY,
      width: badgeWidth,
      height: badgeHeight,
      fill: '#dc2626',
      rx: 6,
      ry: 6,
    }));
    objects.push(new FabricText(badgeText, {
      left: centerX,
      top: currentY + badgeHeight / 2,
      fontSize: badgeFont,
      fontFamily: 'Inter, sans-serif',
      fontWeight: '700',
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
    }));
    currentY += badgeHeight + 8 * groupScale;

    // Promo Price
    const priceSize = (settings.layout === '4' ? 38 : settings.layout === '2' ? 48 : 64) * groupScale;
    const promoText = new FabricText(`Rp ${formatPrice(product.promoPrice)}`, {
      left: centerX,
      top: currentY,
      fontSize: priceSize,
      fontFamily: 'Inter, sans-serif',
      fontWeight: '900',
      fill: '#1f2937',
      originX: 'center',
      originY: 'top',
    });
    objects.push(promoText);
    const promoHeight = promoText.getScaledHeight?.() ?? promoText.height ?? priceSize;
    currentY += promoHeight + 10 * groupScale;

    // Strike Price
    if (settings.showStrikePrice) {
      const strikeFontSize = (settings.layout === '4' ? 14 : settings.layout === '2' ? 16 : 18) * groupScale;
      const strikeText = new FabricText(`Rp ${formatPrice(product.normalPrice)}`, {
        left: centerX,
        top: currentY,
        fontSize: strikeFontSize,
        fontFamily: 'Inter, sans-serif',
        fill: '#9ca3af',
        originX: 'center',
        originY: 'top',
      });
      objects.push(strikeText);

      const textWidth = strikeFontSize * product.normalPrice.toString().length * 0.6 + 30;
      objects.push(new Line([centerX - textWidth / 2, currentY + strikeFontSize / 2, centerX + textWidth / 2, currentY + strikeFontSize / 2], {
        stroke: '#9ca3af',
        strokeWidth: 2,
      }));
      currentY += strikeFontSize + 10 * groupScale;
    }

    // Bottom breakdown row (percent discount only)
    if (product.discountType !== 'cut') {
      const extra = product.extraDiscount ?? 0;
      const member = product.memberDiscount ?? 0;
      const base = Math.max(0, product.discount - extra - member);
      const rows = [];
      if (base > 0) rows.push({ label: 'DISKON', value: `${base}%` });
      if (extra > 0) rows.push({ label: 'EXTRA DISKON', value: `${extra}%` });
      if (member > 0) rows.push({ label: 'DISKON MEMBER', value: `${member}%` });

      if (rows.length > 1) {
        const rowWidth = contentWidth;
        const rowHeight = (settings.layout === '4' ? 36 : settings.layout === '2' ? 40 : 44) * groupScale;
        const cellWidth = rowWidth / rows.length;
        const rowY = currentY + 6 * groupScale;

        objects.push(new Rect({
          left: centerX - rowWidth / 2,
          top: rowY,
          width: rowWidth,
          height: rowHeight,
          fill: '#f3f4f6',
          stroke: '#e5e7eb',
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        }));

        const cellStyles = rows.map((item) => {
          if (item.label === 'DISKON') {
            return { bg: '#dc2626', text: '#ffffff' };
          }
          if (item.label === 'EXTRA DISKON') {
            return { bg: '#f97316', text: '#ffffff' };
          }
          return { bg: '#2563eb', text: '#ffffff' };
        });

        rows.forEach((item, index) => {
          const cellX = centerX - rowWidth / 2 + cellWidth * index;
          const style = cellStyles[index];
          objects.push(new Rect({
            left: cellX,
            top: rowY,
            width: cellWidth,
            height: rowHeight,
            fill: style.bg,
            stroke: '#e5e7eb',
            strokeWidth: 1,
          }));
          objects.push(new FabricText(item.label, {
            left: cellX + cellWidth / 2,
            top: rowY + rowHeight * 0.35,
            fontSize: (settings.layout === '4' ? 9 : settings.layout === '2' ? 10 : 11) * groupScale,
            fontFamily: 'Inter, sans-serif',
            fontWeight: '700',
            fill: style.text,
            originX: 'center',
            originY: 'center',
          }));
          objects.push(new FabricText(item.value, {
            left: cellX + cellWidth / 2,
            top: rowY + rowHeight * 0.7,
            fontSize: (settings.layout === '4' ? 12 : settings.layout === '2' ? 14 : 16) * groupScale,
            fontFamily: 'Inter, sans-serif',
            fontWeight: '700',
            fill: style.text,
            originX: 'center',
            originY: 'center',
          }));
        });
      }
    }

    return new Group(objects);
  }, [drawBarcode]);

  const totalPages = Math.max(products.length, 1);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

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
        tempCanvas.width = A4_WIDTH;
        tempCanvas.height = A4_HEIGHT;
        const canvas = new FabricCanvas(tempCanvas, {
          width: A4_WIDTH,
          height: A4_HEIGHT,
          backgroundColor: '#ffffff',
          selection: false,
        });

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
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                Prev
              </button>
              <button
                className="px-3 py-1 rounded border border-border disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
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
