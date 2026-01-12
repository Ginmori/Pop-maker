import { useEffect, useState } from 'react';
import { Template } from '@/data/templates';
import { templateStorage, CustomTemplate } from '@/lib/templateStorage';
import { TemplateUpload } from './TemplateUpload';
import { Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TemplatePanelProps {
  templates: Template[];
  selectedTemplate: string;
  onSelectTemplateData: (template: Template) => void;
  isAdmin: boolean;
}

export const TemplatePanel = ({
  templates,
  selectedTemplate,
  onSelectTemplateData,
  isAdmin,
}: TemplatePanelProps) => {
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCustomTemplates = async () => {
    try {
      const stored = await templateStorage.getTemplates();
      const converted: Template[] = stored.map((t: CustomTemplate) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        thumbnail: t.name.charAt(0).toUpperCase(),
        layout: 'centered' as const,
        type: 'custom' as const,
        imageUrl: t.imageUrl,
      }));
      setCustomTemplates(converted);
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      toast.error('Gagal memuat template custom');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Hapus template ini?')) return;

    try {
      await templateStorage.deleteTemplate(templateId);
      toast.success('Template berhasil dihapus');
      await loadCustomTemplates();

      // If deleted template was selected, select first available template
      if (selectedTemplate === templateId) {
        const fallback = templates[0] || customTemplates[0];
        if (fallback) {
          onSelectTemplateData(fallback);
        }
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Gagal menghapus template');
    }
  };

  const allTemplates = [...templates, ...customTemplates];

  return (
    <div className="space-y-3">
      <h3 className="section-title">Template</h3>

      {loading ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Loading templates...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {allTemplates.map((template) => {
              const isSelected = selectedTemplate === template.id;
              const isCustom = template.type === 'custom';

              return (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelectTemplateData(template);
                  }}
                  className={`template-card ${isSelected ? 'selected' : ''} relative group`}
                >
                  {isSelected && (
                    <div className="absolute top-1 left-1 w-5 h-5 bg-primary rounded flex items-center justify-center z-10">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}

                  {isCustom && isAdmin && (
                    <button
                      onClick={(e) => handleDeleteTemplate(template.id, e)}
                      className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Hapus template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {/* Template Thumbnail Preview */}
                  {isCustom && template.imageUrl ? (
                    <div className="bg-muted rounded aspect-[3/4] mb-2 overflow-hidden">
                      <img
                        src={template.imageUrl}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted rounded aspect-[3/4] mb-2 flex flex-col items-center justify-center p-2 gap-1">
                      <div className="w-full h-2 bg-border rounded" />
                      <div className="text-xs font-medium text-muted-foreground">Nama Produk</div>
                      <div className="text-sm font-bold text-foreground">Rp 35.000</div>
                      <div className="w-8 h-4 bg-border rounded mt-1" />
                    </div>
                  )}

                  <p className="text-xs font-medium text-center text-foreground truncate">
                    {template.name}
                  </p>
                  {isCustom && (
                    <span className="text-[10px] text-muted-foreground text-center block">Custom</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Upload Button */}
          {isAdmin ? <TemplateUpload onUploadComplete={loadCustomTemplates} /> : null}
        </>
      )}
    </div>
  );
};
