import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { templateStorage } from '@/lib/templateStorage';

interface TemplateUploadProps {
    onUploadComplete: () => void;
}

export const TemplateUpload = ({ onUploadComplete }: TemplateUploadProps) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('File harus berupa gambar (JPG, PNG, etc)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 5MB');
            return;
        }

        // Read file as base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setImageData(result);
            setPreviewUrl(result);
        };
        reader.onerror = () => {
            toast.error('Gagal membaca file');
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!name.trim()) {
            toast.error('Nama template harus diisi');
            return;
        }

        if (!imageData) {
            toast.error('Pilih gambar template terlebih dahulu');
            return;
        }

        setUploading(true);

        try {
            await templateStorage.uploadTemplate({
                name: name.trim(),
                description: description.trim() || 'Custom template',
                imageData,
            });

            toast.success(`Template "${name}" berhasil diupload!`);

            // Reset form
            setName('');
            setDescription('');
            setPreviewUrl(null);
            setImageData(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            setOpen(false);
            onUploadComplete();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Gagal upload template');
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePreview = () => {
        setPreviewUrl(null);
        setImageData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="w-full py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    Upload Template Baru
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Upload Template Custom</DialogTitle>
                    <DialogDescription>
                        Upload template POP custom (JPG/PNG). Ukuran maksimal 5MB.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label htmlFor="template-file">Template Image</Label>
                        {!previewUrl ? (
                            <div
                                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground mb-1">
                                    Klik untuk pilih gambar
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    JPG, PNG (Max 5MB)
                                </p>
                            </div>
                        ) : (
                            <div className="relative border rounded-lg overflow-hidden">
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-full h-48 object-contain bg-muted"
                                />
                                <button
                                    onClick={handleRemovePreview}
                                    className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            id="template-file"
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>

                    {/* Template Name */}
                    <div className="space-y-2">
                        <Label htmlFor="template-name">Nama Template</Label>
                        <Input
                            id="template-name"
                            placeholder="e.g. Template Promo Ramadan"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Template Description */}
                    <div className="space-y-2">
                        <Label htmlFor="template-desc">Deskripsi (Optional)</Label>
                        <Input
                            id="template-desc"
                            placeholder="e.g. Template untuk produk promo"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="flex-1"
                        disabled={uploading}
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleUpload}
                        className="flex-1"
                        disabled={uploading || !imageData || !name.trim()}
                    >
                        {uploading ? (
                            <>
                                <Upload className="w-4 h-4 mr-2 animate-pulse" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Template
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
