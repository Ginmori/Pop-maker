import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Grid2X2, Grid3X3, Square } from 'lucide-react';

export interface PopSettingsState {
  showStrikePrice: boolean;
  showDiscount: boolean;
  showBarcode: boolean;
  layout: '1' | '2' | '4';
}

interface PopSettingsProps {
  settings: PopSettingsState;
  onSettingsChange: (settings: PopSettingsState) => void;
}

const layoutOptions = [
  { value: '1' as const, label: '1 POP / A4', icon: Square }
];

export const PopSettings = ({ settings, onSettingsChange }: PopSettingsProps) => {
  const handleCheckboxChange = (key: keyof PopSettingsState) => (checked: boolean) => {
    onSettingsChange({ ...settings, [key]: checked });
  };

  const handleLayoutChange = (layout: '1' | '2' | '4') => {
    onSettingsChange({ ...settings, layout });
  };

  return (
    <div className="space-y-4">
      <h3 className="section-title">Pengaturan POP</h3>

      {/* Checkbox Options */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showStrikePrice"
            checked={settings.showStrikePrice}
            onCheckedChange={handleCheckboxChange('showStrikePrice')}
          />
          <Label htmlFor="showStrikePrice" className="text-sm cursor-pointer">
            Tampilkan Harga Coret
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showDiscount"
            checked={settings.showDiscount}
            onCheckedChange={handleCheckboxChange('showDiscount')}
          />
          <Label htmlFor="showDiscount" className="text-sm cursor-pointer">
            Tampilkan Diskon %
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showDiscount"
            checked={settings.showDiscount}
            onCheckedChange={handleCheckboxChange('showDiscount')}
          />
          <Label htmlFor="showDiscount" className="text-sm cursor-pointer">
            Tampilkan Diskon 2 %
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showDiscount"
            checked={settings.showDiscount}
            onCheckedChange={handleCheckboxChange('showDiscount')}
          />
          <Label htmlFor="showDiscount" className="text-sm cursor-pointer">
            Tampilkan Diskon 3 %
          </Label>
        </div>
      </div>

      {/* Layout Options */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Layout per Halaman:</p>
        <div className="flex gap-2">
          {layoutOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleLayoutChange(value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-lg border transition-all ${settings.layout === value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
