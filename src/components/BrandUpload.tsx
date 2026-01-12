import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Brand } from '@/data/brands';
import { getAuthToken } from '@/lib/auth';

interface BrandUploadProps {
  onAdd: (brand: Brand) => void;
}

export const BrandUpload = ({ onAdd }: BrandUploadProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [logoData, setLogoData] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setLogoData(result);
    };
    reader.onerror = () => toast.error('Gagal membaca file');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Nama brand wajib diisi');
      return;
    }
    if (!logoData) {
      toast.error('Logo wajib diunggah');
      return;
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      const response = await fetch('/api/brand-logos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageData: logoData }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Gagal mengunggah logo');
      }

      const payload = await response.json();
      const brand: Brand = {
        id: `brand-${Date.now()}`,
        name: trimmedName,
        logoData: payload.url,
        logoText: trimmedName.slice(0, 2).toUpperCase(),
      };

      onAdd(brand);
      setName('');
      setLogoData(undefined);
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
      toast.success('Brand ditambahkan');
    } catch (error) {
      console.error('Upload logo error:', error);
      toast.error('Gagal menyimpan logo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Tambah Brand
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Tambah Brand</DialogTitle>
          <DialogDescription>Isi nama brand dan upload logo untuk digunakan di POP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nama Brand</Label>
            <Input
              id="brand-name"
              placeholder="Contoh: Mitra Bangunan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Logo Brand</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-3">
              {logoData ? (
                <img src={logoData} alt="Preview logo" className="h-20 object-contain" />
              ) : (
                <div className="text-sm text-muted-foreground">Unggah gambar (PNG/JPG, maks 5MB)</div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Pilih File
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Menyimpan...' : 'Simpan Brand'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
