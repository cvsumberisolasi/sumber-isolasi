
'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { FixedAsset, Account, NewFixedAsset } from '@/lib/types';
import { addFixedAsset } from '@/app/(app)/fixed-assets/actions';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '../ui/textarea';

interface AssetFormDialogProps {
  children: React.ReactNode;
  asset?: FixedAsset;
  accounts: Account[];
}

export function AssetFormDialog({ children, asset, accounts }: AssetFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [assetCode, setAssetCode] = useState(asset?.assetCode || '');
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [acquisitionDate, setAcquisitionDate] = useState<Date | undefined>(asset?.acquisitionDate ? (asset.acquisitionDate as any).toDate() : new Date());
  const [acquisitionCost, setAcquisitionCost] = useState(asset?.acquisitionCost || 0);
  const [usefulLife, setUsefulLife] = useState(asset?.usefulLife || 5);
  const [assetAccountId, setAssetAccountId] = useState(asset?.assetAccountId || '');
  const [accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId] = useState(asset?.accumulatedDepreciationAccountId || '');
  const [depreciationExpenseAccountId, setDepreciationExpenseAccountId] = useState(asset?.depreciationExpenseAccountId || '');
  const [paymentAccountId, setPaymentAccountId] = useState('');


  const isEditing = !!asset;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acquisitionDate || acquisitionCost <= 0 || !assetAccountId || !accumulatedDepreciationAccountId || !depreciationExpenseAccountId || !paymentAccountId) {
      toast({ title: 'Data tidak lengkap', description: 'Mohon isi semua field yang wajib diisi.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const assetAccount = accounts.find(a => a.id === assetAccountId);
      const accDepAccount = accounts.find(a => a.id === accumulatedDepreciationAccountId);
      const depExpAccount = accounts.find(a => a.id === depreciationExpenseAccountId);

      if (!assetAccount || !accDepAccount || !depExpAccount) {
        toast({ title: 'Akun tidak valid', variant: 'destructive' });
        return;
      }
      
      const assetData: NewFixedAsset = {
        assetCode,
        name,
        description,
        acquisitionDate,
        acquisitionCost,
        usefulLife,
        depreciationMethod: 'Garis Lurus',
        assetAccountId,
        assetAccountName: assetAccount.name,
        accumulatedDepreciationAccountId,
        accumulatedDepreciationAccountName: accDepAccount.name,
        depreciationExpenseAccountId,
        depreciationExpenseAccountName: depExpAccount.name,
      };

      const result = isEditing ? {error: 'Editing not implemented'} /* await update... */ : await addFixedAsset(assetData, paymentAccountId);

      if (result.error) {
        toast({ title: `Gagal ${isEditing ? 'memperbarui' : 'menambahkan'} Aset`, description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `Aset ${isEditing ? 'diperbarui' : 'ditambahkan'}`, description: `${name} telah berhasil disimpan.` });
        setOpen(false);
        // resetForm(); // You might want a reset function
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    setOpen(isOpen);
  };
  
  const { assetAccounts, accDepreciationAccounts, depExpenseAccounts, cashBankAccounts } = useMemo(() => {
    return {
        assetAccounts: accounts.filter(a => a.type === 'Aset Tetap'),
        accDepreciationAccounts: accounts.filter(a => a.type === 'Akumulasi Penyusutan'),
        depExpenseAccounts: accounts.filter(a => a.type === 'Beban Operasional'),
        cashBankAccounts: accounts.filter(a => a.type === 'Kas & Bank'),
    }
  }, [accounts]);


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Aset Tetap' : 'Tambah Aset Tetap Baru'}</DialogTitle>
          <DialogDescription>
            Isi detail aset tetap yang diperoleh perusahaan. Jurnal akuisisi akan dibuat secara otomatis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assetName">Nama Aset</Label>
              <Input id="assetName" value={name} onChange={(e) => setName(e.target.value)} required disabled={isPending} placeholder="Contoh: Laptop Dell XPS 15" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetCode">Kode Aset</Label>
              <Input id="assetCode" value={assetCode} onChange={(e) => setAssetCode(e.target.value)} disabled={isPending} placeholder="Opsional, contoh: KND-001" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} placeholder="Deskripsi atau spesifikasi aset" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-2">
              <Label htmlFor="acquisitionDate">Tanggal Perolehan</Label>
              <DatePicker date={acquisitionDate} setDate={setAcquisitionDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acquisitionCost">Harga Perolehan</Label>
              <Input id="acquisitionCost" type="number" value={acquisitionCost} onChange={(e) => setAcquisitionCost(Number(e.target.value))} required disabled={isPending} onFocus={(e) => e.target.select()} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="usefulLife">Masa Manfaat (Tahun)</Label>
              <Input id="usefulLife" type="number" value={usefulLife} onChange={(e) => setUsefulLife(Number(e.target.value))} required disabled={isPending} onFocus={(e) => e.target.select()} />
            </div>
          </div>

          <hr className="my-4" />
          <h3 className="font-semibold">Pemetaan Akun</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Akun Aset</Label>
                <Select value={assetAccountId} onValueChange={setAssetAccountId} required>
                    <SelectTrigger><SelectValue placeholder="Pilih akun aset..." /></SelectTrigger>
                    <SelectContent>
                        {assetAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label>Akun Pembayaran (Sumber Dana)</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId} required>
                    <SelectTrigger><SelectValue placeholder="Pilih akun kas/bank..." /></SelectTrigger>
                    <SelectContent>
                        {cashBankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label>Akun Akumulasi Penyusutan</Label>
                <Select value={accumulatedDepreciationAccountId} onValueChange={setAccumulatedDepreciationAccountId} required>
                    <SelectTrigger><SelectValue placeholder="Pilih akun akumulasi..." /></SelectTrigger>
                    <SelectContent>
                        {accDepreciationAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label>Akun Beban Penyusutan</Label>
                <Select value={depreciationExpenseAccountId} onValueChange={setDepreciationExpenseAccountId} required>
                    <SelectTrigger><SelectValue placeholder="Pilih akun beban..." /></SelectTrigger>
                    <SelectContent>
                        {depExpenseAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>


          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Aset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
