
'use client';

import React, { useState, useTransition } from 'react';
import { Plus, MoreHorizontal, Loader2, Edit, Trash2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Currency } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addCurrency, updateCurrency, deleteCurrency } from '@/app/(app)/currencies/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { seedInitialCurrencies } from '@/lib/seed-actions';


export function CurrencyActions({ hasCurrencies }: { hasCurrencies: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedInitialCurrencies();
      if (result.error) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Contoh data mata uang berhasil ditambahkan.' });
      }
    });
  }

  return (
     <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
             <Button variant="outline" disabled={hasCurrencies || isPending}>
                <Database className="mr-2 h-4 w-4" /> Seed Mata Uang
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menambahkan beberapa contoh data mata uang ke database Anda.
                Tindakan ini hanya bisa dilakukan jika daftar mata uang Anda masih kosong.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleSeed} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Lanjutkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
       
        <CurrencyFormDialog>
            <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Mata Uang
            </Button>
        </CurrencyFormDialog>
    </div>
  );
}

export function CurrencyRowActions({ currency }: { currency: Currency }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCurrency(currency.id);
      if (result.error) {
        toast({ title: 'Gagal Menghapus', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Mata Uang Dihapus', description: `${currency.name} telah berhasil dihapus.` });
        setIsDeleteDialogOpen(false);
      }
    });
  }

  return (
     <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Buka menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
             <CurrencyFormDialog currency={currency}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
            </CurrencyFormDialog>
            <DropdownMenuItem className="text-destructive" onSelect={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anda yakin?</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus mata uang <span className="font-semibold">{currency.name}</span> secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isPending}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CurrencyFormDialog({ children, currency }: { children: React.ReactNode, currency?: Currency }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [name, setName] = useState(currency?.name || '');
  const [code, setCode] = useState(currency?.code || '');
  const [symbol, setSymbol] = useState(currency?.symbol || '');
  const [exchangeRate, setExchangeRate] = useState(currency?.exchangeRate || 1);
  
  const isEditing = !!currency;
  const isDropdownItem = React.isValidElement(children) && (children.type as any).displayName === 'DropdownMenuItem';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const data = { name, code, symbol, exchangeRate: Number(exchangeRate) };
      const result = isEditing
        ? await updateCurrency(currency.id, data)
        : await addCurrency(data);

      if (result.error) {
        toast({ title: `Gagal menyimpan`, description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `Mata uang berhasil disimpan.` });
        setOpen(false);
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
        setName(currency?.name || '');
        setCode(currency?.code || '');
        setSymbol(currency?.symbol || '');
        setExchangeRate(currency?.exchangeRate || 1);
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isDropdownItem ? <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><Edit className="mr-2 h-4 w-4" /> Edit</div> : children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Mata Uang' : 'Tambah Mata Uang Baru'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Mata Uang</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isPending} placeholder="Contoh: Rupiah Indonesia"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="code">Kode</Label>
                    <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required disabled={isPending} placeholder="IDR"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="symbol">Simbol</Label>
                    <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} required disabled={isPending} placeholder="Rp"/>
                </div>
            </div>
             <div className="space-y-2">
              <Label htmlFor="exchangeRate">Kurs</Label>
              <Input id="exchangeRate" type="number" step="any" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} onFocus={(e) => e.target.select()} required disabled={isPending} />
              <p className="text-xs text-muted-foreground">Nilai tukar relatif terhadap mata uang dasar (misal, 1 untuk IDR).</p>
            </div>
          <DialogFooter>
             <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
