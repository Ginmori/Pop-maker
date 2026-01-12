import { Button } from '@/components/ui/button';
import { Eye, Download, Printer } from 'lucide-react';

interface ActionBarProps {
  onGeneratePreview: () => void;
  onDownloadPDF: () => void;
  onPrint: () => void;
  hasProducts: boolean;
}

export const ActionBar = ({
  onGeneratePreview,
  onDownloadPDF,
  onPrint,
  hasProducts,
}: ActionBarProps) => {
  return (
    <div className="space-y-3">
      <h3 className="section-title">Aksi</h3>
      
      <div className="space-y-2">
        <Button
          onClick={onGeneratePreview}
          disabled={!hasProducts}
          className="w-full"
          size="lg"
        >
          <Eye className="w-4 h-4 mr-2" />
          Generate Preview
        </Button>
        
        <div className="flex gap-2">
          <Button
            onClick={onDownloadPDF}
            disabled={!hasProducts}
            variant="secondary"
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          
          <Button
            onClick={onPrint}
            disabled={!hasProducts}
            variant="secondary"
            className="flex-1"
          >
            <Printer className="w-4 h-4 mr-2" />
            Cetak
          </Button>
        </div>
      </div>
    </div>
  );
};
