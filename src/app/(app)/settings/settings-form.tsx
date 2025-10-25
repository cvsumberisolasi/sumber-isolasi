'use client';

import React, { useState, useTransition, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { CompanySettings, updateCompanySettings } from './actions';
import Image from 'next/image';

export function SettingsForm({ initialData }: { initialData: CompanySettings }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [companyName, setCompanyName] = useState(initialData.companyName || "Toko Kilat");
  const [address, setAddress] = useState(initialData.address || "");
  const [phone, setPhone] = useState(initialData.phone || "");
  const [email, setEmail] = useState(initialData.email || "");
  const [logoDataUrl, setLogoDataUrl] = useState(initialData.logoDataUrl || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'File tidak valid', description: 'Mohon pilih file gambar (PNG, JPG, dll).', variant: 'destructive' });
        return;
      }
      if (file.size > 1024 * 1024) { // 1MB limit
        toast({ title: 'Ukuran file terlalu besar', description: 'Ukuran logo maksimal adalah 1MB.', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = () => {
    startTransition(async () => {
      const result = await updateCompanySettings({
        companyName,
        address,
        phone,
        email,
        logoDataUrl,
      });

      if (result.error) {
        toast({
          title: "Gagal Menyimpan",
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: "Pengaturan Disimpan",
          description: "Informasi perusahaan telah berhasil diperbarui.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor="company-name">Nama Perusahaan</Label>
            <Input 
              id="company-name" 
              placeholder="Contoh: Toko Kilat Sejahtera" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-address">Alamat</Label>
            <Textarea 
              id="company-address" 
              placeholder="Masukkan alamat lengkap perusahaan"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="company-phone">Nomor Telepon</Label>
                <Input 
                  id="company-phone" 
                  placeholder="Contoh: 021-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="company-email">Email</Label>
                <Input 
                  id="company-email" 
                  type="email" 
                  placeholder="Contoh: kontak@tokokilat.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo Perusahaan</Label>
            <div className="flex items-center gap-4">
              {logoDataUrl ? (
                  <div className="relative">
                      <Image src={logoDataUrl} alt="Logo Preview" width={64} height={64} className="rounded-md border object-contain"/>
                      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => setLogoDataUrl(null)}>
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
              ) : null}
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                  <Upload className="mr-2 h-4 w-4" />
                  Unggah Logo
              </Button>
            </div>
            <input 
              id="logo" 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/png, image/jpeg, image/svg+xml"
            />
            <p className="text-xs text-muted-foreground">Disarankan format PNG transparan atau JPG. Ukuran maks 1MB.</p>
          </div>
          <div className="flex justify-end">
             <Button onClick={handleSaveChanges} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Perubahan
             </Button>
          </div>
    </div>
  );
}
