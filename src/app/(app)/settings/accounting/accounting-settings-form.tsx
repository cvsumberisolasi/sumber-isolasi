

'use client';

import React, { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { AccountingSettings, updateAccountingSettings } from './actions';
import type { Account } from '@/lib/types';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface AccountingSettingsFormProps {
  initialData: AccountingSettings;
  accounts: Account[];
}

export function AccountingSettingsForm({ initialData, accounts }: AccountingSettingsFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [cashAccountId, setCashAccountId] = useState(initialData.cashAccountId || '');
  const [bankAccountId, setBankAccountId] = useState(initialData.bankAccountId || '');
  const [salesRevenueAccountId, setSalesRevenueAccountId] = useState(initialData.salesRevenueAccountId || '');
  const [salesDiscountAccountId, setSalesDiscountAccountId] = useState(initialData.salesDiscountAccountId || '');
  const [marketplaceFeeAccountId, setMarketplaceFeeAccountId] = useState(initialData.marketplaceFeeAccountId || '');
  const [cogsAccountId, setCogsAccountId] = useState(initialData.cogsAccountId || '');
  const [inventoryAccountId, setInventoryAccountId] = useState(initialData.inventoryAccountId || '');
  const [accountsReceivableAccountId, setAccountsReceivableAccountId] = useState(initialData.accountsReceivableAccountId || '');
  const [accountsPayableAccountId, setAccountsPayableAccountId] = useState(initialData.accountsPayableAccountId || '');
  const [accruedPayableAccountId, setAccruedPayableAccountId] = useState(initialData.accruedPayableAccountId || '');
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState(initialData.retainedEarningsAccountId || '');
  const [incomeSummaryAccountId, setIncomeSummaryAccountId] = useState(initialData.incomeSummaryAccountId || '');
  const [taxPayableAccountId, setTaxPayableAccountId] = useState(initialData.taxPayableAccountId || '');
  
  const [rawMaterialInventoryAccountId, setRawMaterialInventoryAccountId] = useState(initialData.rawMaterialInventoryAccountId || '');
  const [wipAccountId, setWipAccountId] = useState(initialData.wipAccountId || '');
  const [directLaborAccountId, setDirectLaborAccountId] = useState(initialData.directLaborAccountId || '');
  const [manufacturingOverheadAccountId, setManufacturingOverheadAccountId] = useState(initialData.manufacturingOverheadAccountId || '');


  const handleSaveChanges = () => {
    startTransition(async () => {
      const result = await updateAccountingSettings({
        cashAccountId,
        bankAccountId,
        salesRevenueAccountId,
        salesDiscountAccountId,
        marketplaceFeeAccountId,
        cogsAccountId,
        inventoryAccountId,
        accountsReceivableAccountId,
        accountsPayableAccountId,
        accruedPayableAccountId,
        retainedEarningsAccountId,
        incomeSummaryAccountId,
        taxPayableAccountId,
        rawMaterialInventoryAccountId,
        wipAccountId,
        directLaborAccountId,
        manufacturingOverheadAccountId,
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
          description: "Pemetaan akun telah berhasil diperbarui.",
        });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-lg font-medium">Penjualan & Piutang</h3>
      <div className="space-y-2">
        <Label>Akun Kas (Untuk Pembayaran Tunai)</Label>
        <Select value={cashAccountId} onValueChange={setCashAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun kas..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Kas & Bank').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Akun Bank (Untuk Pembayaran Transfer)</Label>
        <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun bank..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Kas & Bank').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

       <div className="space-y-2">
        <Label>Akun Piutang Usaha</Label>
        <Select value={accountsReceivableAccountId} onValueChange={setAccountsReceivableAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun piutang usaha..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Aset Lancar').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Akun Pendapatan Penjualan</Label>
        <Select value={salesRevenueAccountId} onValueChange={setSalesRevenueAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun pendapatan..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Pendapatan').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

       <div className="space-y-2">
        <Label>Akun Diskon Penjualan (Kontra-Pendapatan)</Label>
        <Select value={salesDiscountAccountId} onValueChange={setSalesDiscountAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun diskon penjualan..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Pendapatan').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Akun Beban Marketplace (Fee)</Label>
        <Select value={marketplaceFeeAccountId} onValueChange={setMarketplaceFeeAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun beban marketplace..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Beban Operasional').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Akun Utang Pajak</Label>
        <Select value={taxPayableAccountId} onValueChange={setTaxPayableAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun utang pajak..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Kewajiban Jangka Pendek').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <Separator />
      <h3 className="text-lg font-medium">Pembelian & Persediaan</h3>

      <div className="space-y-2">
        <Label>Akun Utang Usaha</Label>
        <Select value={accountsPayableAccountId} onValueChange={setAccountsPayableAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun utang usaha..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Kewajiban Jangka Pendek').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Akun Utang Barang Diterima (GRNI)</Label>
        <Select value={accruedPayableAccountId} onValueChange={setAccruedPayableAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun utang barang diterima..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Kewajiban Jangka Pendek').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <div className="space-y-2">
        <Label>Akun Beban Pokok Penjualan (HPP)</Label>
        <Select value={cogsAccountId} onValueChange={setCogsAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun HPP..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Beban Pokok Penjualan').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Akun Persediaan Barang Dagang/Jadi</Label>
        <Select value={inventoryAccountId} onValueChange={setInventoryAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun persediaan..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Aset Lancar').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      <h3 className="text-lg font-medium">Produksi</h3>

      <div className="space-y-2">
        <Label>Akun Persediaan Bahan Baku</Label>
        <Select value={rawMaterialInventoryAccountId} onValueChange={setRawMaterialInventoryAccountId} disabled={isPending}>
          <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Aset Lancar').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
       <div className="space-y-2">
        <Label>Akun Barang Dalam Proses (WIP)</Label>
        <Select value={wipAccountId} onValueChange={setWipAccountId} disabled={isPending}>
          <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Aset Lancar').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
       <div className="space-y-2">
        <Label>Akun Biaya Tenaga Kerja Langsung</Label>
        <Select value={directLaborAccountId} onValueChange={setDirectLaborAccountId} disabled={isPending}>
          <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Beban Pokok Penjualan').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
       <div className="space-y-2">
        <Label>Akun Biaya Overhead Pabrik</Label>
        <Select value={manufacturingOverheadAccountId} onValueChange={setManufacturingOverheadAccountId} disabled={isPending}>
          <SelectTrigger><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Beban Pokok Penjualan').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />
      <h3 className="text-lg font-medium">Tutup Buku</h3>
      
       <div className="space-y-2">
        <Label>Akun Ikhtisar Laba Rugi</Label>
        <Select value={incomeSummaryAccountId} onValueChange={setIncomeSummaryAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun ikhtisar laba rugi..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Ekuitas').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

       <div className="space-y-2">
        <Label>Akun Laba Ditahan</Label>
        <Select value={retainedEarningsAccountId} onValueChange={setRetainedEarningsAccountId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih akun laba ditahan..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => a.type === 'Ekuitas').map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <div className="flex justify-end pt-4">
        <Button onClick={handleSaveChanges} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  );
}
