import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templates, Template } from '@/data/templates';
import { templateStorage } from '@/lib/templateStorage';
import { Product, searchProduct } from '@/data/products';
import { fetchProductBySku } from '@/lib/productApi';
import { brands as defaultBrands, Brand } from '@/data/brands';
import { TemplatePanel } from '@/components/TemplatePanel';
import { SKUForm } from '@/components/SKUForm';
import { ActionBar } from '@/components/ActionBar';
import { PopPreview, PopPreviewHandle } from '@/components/PopPreview';
import { BrandUpload } from '@/components/BrandUpload';
import { toast } from 'sonner';
import { Globe, ChevronDown, User } from 'lucide-react';
import jsPDF from 'jspdf';
import { clearAuthToken, getAuthToken, getAuthUser, setAuthUser } from '@/lib/auth';

const BRAND_STORAGE_KEY = 'popmaker.brands';

const isValidBrand = (value: unknown): value is Brand => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
};

const readStoredBrands = (): Brand[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BRAND_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBrand);
  } catch (error) {
    console.warn('Failed to read stored brands:', error);
    return [];
  }
};

const writeStoredBrands = (brands: Brand[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brands));
};

const EditorPage = () => {
  const navigate = useNavigate();
  const [userLabel, setUserLabel] = useState(() => getAuthUser()?.username || 'User');
  const [isAdmin, setIsAdmin] = useState(() => getAuthUser()?.username === 'admin');
  const defaultTemplate = templates[0];
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate?.id || '');
  const [selectedTemplateData, setSelectedTemplateData] = useState<Template>(
    defaultTemplate || {
      id: '',
      name: '',
      description: '',
      thumbnail: '',
      layout: 'centered' as const,
      type: 'custom' as const,
    }
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [brandList, setBrandList] = useState<Brand[]>(defaultBrands);
  const [previewScale, setPreviewScale] = useState(0.75);
  const previewRef = useRef<HTMLDivElement>(null);
  const popPreviewRef = useRef<PopPreviewHandle>(null);
  const popSettings = {
    showStrikePrice: true,
    showDiscount: true,
    showBarcode: true,
    layout: '1' as const,
  };

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Load default product on mount
  useEffect(() => {
    const storedBrands = readStoredBrands();
    if (storedBrands.length > 0) {
      const defaultIds = new Set(defaultBrands.map((brand) => brand.id));
      const customBrands = storedBrands.filter((brand) => !defaultIds.has(brand.id));
      setBrandList([...defaultBrands, ...customBrands]);
    }
  }, []);

  useEffect(() => {
    setProducts([]);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const response = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.user?.username) {
          setAuthUser(data.user);
          setUserLabel(data.user.username);
          setIsAdmin(data.user.username === 'admin');
        }
      } catch (error) {
        console.warn('Failed to load profile:', error);
      }
    };

    fetchProfile();
  }, []);

  // Update selected template data when template selection changes
  useEffect(() => {
    const loadTemplateData = async () => {
      // Check default templates first
      const defaultTemplate = templates.find(t => t.id === selectedTemplate);
      if (defaultTemplate) {
        setSelectedTemplateData(defaultTemplate);
        return;
      }

      if (selectedTemplateData?.id === selectedTemplate && selectedTemplateData?.imageUrl) {
        return;
      }

      // Check custom templates
      try {
        const customTemplate = await templateStorage.getTemplate(selectedTemplate);
        if (customTemplate) {
          setSelectedTemplateData({
            id: customTemplate.id,
            name: customTemplate.name,
            description: customTemplate.description,
            thumbnail: customTemplate.name.charAt(0).toUpperCase(),
            layout: 'centered',
            type: 'custom',
            imageUrl: customTemplate.imageUrl,
          });
        }
      } catch (error) {
        console.error('Failed to load template data:', error);
      }
    };

    loadTemplateData();
  }, [selectedTemplate, selectedTemplateData]);

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template.id);
    setSelectedTemplateData(template);
  }, []);

  const handleAddProduct = useCallback((product: Product) => {
    setProducts((prev) => [...prev, product]);
  }, []);

  const handleAddBrand = useCallback((brand: Brand) => {
    setBrandList((prev) => {
      const next = [...prev, brand];
      const defaultIds = new Set(defaultBrands.map((item) => item.id));
      const customBrands = next.filter((item) => !defaultIds.has(item.id));
      writeStoredBrands(customBrands);
      return next;
    });
  }, []);

  const handleRemoveProduct = useCallback((sku: string) => {
    setProducts((prev) => prev.filter((p) => p.sku !== sku));
  }, []);

  const handleGeneratePreview = useCallback(() => {
    toast.success('Preview diperbarui!');
  }, []);

  const handleDownloadPDF = useCallback(() => {
    const run = async () => {
      const images = await popPreviewRef.current?.getPageImages();
      if (!images || images.length === 0) {
        toast.error('Preview tidak tersedia');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      images.forEach((img, index) => {
        if (index > 0) pdf.addPage();
        pdf.addImage(img, 'PNG', 0, 0, 595, 842);
      });

      pdf.save('pop-price-tag.pdf');
      toast.success('PDF berhasil diunduh!');
    };

    run().catch((error) => {
      console.error('Failed to build PDF:', error);
      toast.error('Gagal membuat PDF');
    });
  }, []);

  const handlePrint = useCallback(() => {
    const run = async () => {
      const images = await popPreviewRef.current?.getPageImages();
      if (!images || images.length === 0) {
        toast.error('Preview tidak tersedia');
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        toast.error('Gagal menyiapkan print');
        iframe.remove();
        return;
      }

      const pages = images.map((src) => `<div class="page"><img src="${src}" /></div>`).join('');

      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Print POP</title>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; }
              .page { width: 210mm; height: 297mm; page-break-after: always; display: flex; justify-content: center; align-items: center; }
              img { width: 210mm; height: 297mm; }
            </style>
          </head>
          <body>
            ${pages}
          </body>
        </html>
      `);
      doc.close();

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 500);
      };
    };

    run().catch((error) => {
      console.error('Failed to print pages:', error);
      toast.error('Gagal print');
    });
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
        <h1 className="text-lg font-bold text-foreground">POP Maker - Mitra Bangunan Supermarket</h1>

        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="w-4 h-4" />
            <span>Bahasa:</span>
            <span className="font-medium">ID</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {isAdmin ? (
            <BrandUpload
              onAdd={handleAddBrand}
            />
          ) : null}

          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span>{userLabel}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Controls */}
        <aside className="w-[35%] min-w-[320px] max-w-[480px] border-r border-border bg-card overflow-y-auto scrollbar-thin">
          <div className="p-5 space-y-6">
            <TemplatePanel
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelectTemplateData={handleSelectTemplate}
              isAdmin={isAdmin}
            />

            <div className="h-px bg-border" />

            <SKUForm
              products={products}
              onAddProduct={handleAddProduct}
              onRemoveProduct={handleRemoveProduct}
              brands={brandList}
            />

            <div className="h-px bg-border" />

            <ActionBar
              onGeneratePreview={handleGeneratePreview}
              onDownloadPDF={handleDownloadPDF}
              onPrint={handlePrint}
              hasProducts={products.length > 0}
            />
          </div>
        </aside>

        {/* Right Panel - Preview */}
        <main className="flex-1 p-6 overflow-hidden bg-preview" ref={previewRef}>
          <PopPreview
            products={products}
            settings={popSettings}
            selectedTemplateData={selectedTemplateData}
            previewScale={previewScale}
            onScaleChange={setPreviewScale}
            ref={popPreviewRef}
          />
        </main>
      </div>
    </div>
  );
};

export default EditorPage;
