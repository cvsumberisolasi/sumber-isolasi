
'use client';

import React, { useState, useTransition } from 'react';
import { Plus, MoreHorizontal, Loader2, FileUp, Edit, Trash2, Database } from 'lucide-react';
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
import type { Account } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addAccount, updateAccount, deleteAccount } from '@/app/(app)/accounting/coa/actions';
import { seedInitialAccounts } from '@/lib/seed-actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const ACCOUNT_TYPES = [
    "Aset Lancar", "Kas & Bank", "Aset Tetap", "Akumulasi Penyusutan", "Aset Lainnya", 
    "Kewajiban Jangka Pendek", "Kewajiban Jangka Panjang", "Ekuitas", "Pendapatan", 
    "Beban Pokok Penjualan", "Beban Operasional", "Pendapatan Lainnya", "Beban Lainnya"
];


export function CoaActions({ hasAccounts }: { hasAccounts: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedInitialAccounts();
      if (result.error) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Akun standar berhasil ditambahkan.' });
      }
    });
  }

  return (
     <div className="flex flex-col sm:flex-row gap-2 w-full">
        <AlertDialog>
          <AlertDialogTrigger asChild>
             <Button variant="outline" className="w-full" disabled={hasAccounts || isPending}>
                <Database className="mr-2 h-4 w-4" /> Gunakan Akun Standar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menambahkan daftar akun standar (PSAK) ke dalam bagan akun Anda.
                Tindakan ini hanya bisa dilakukan jika bagan akun Anda masih kosong.
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
       
        <AccountFormDialog>
            <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Akun
            </Button>
        </AccountFormDialog>
    </div>
  );
}

export function CoaRowActions({ account }: { account: Account }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) {
        toast({
          title: 'Gagal Menghapus',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Akun Dihapus',
          description: `Akun ${account.name} telah berhasil dihapus.`,
        });
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
            <AccountFormDialog account={account}>
                 <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
            </AccountFormDialog>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anda yakin?</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat diurungkan. Ini akan menghapus akun 
              bernama <span className="font-semibold">{account.name}</span> secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isPending}>
              Batal
            </Button>
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


function AccountFormDialog({ children, account }: { children: React.ReactNode, account?: Account }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [code, setCode] = useState(account?.code || '');
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState(account?.type || '');
  
  const isEditing = !!account;
  const isDropdownItem = React.isValidElement(children) && (children.type as any).displayName === 'DropdownMenuItem';


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) {
        toast({
            title: 'Tipe Akun Dibutuhkan',
            description: 'Silakan pilih tipe akun.',
            variant: 'destructive',
        });
        return;
    }
    startTransition(async () => {
      const accountData = { code, name, type };
      const result = isEditing
        ? await updateAccount(account.id, accountData)
        : await addAccount(accountData);

      if (result.error) {
        toast({
          title: `Gagal ${isEditing ? 'memperbarui' : 'menambahkan'} akun`,
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: `Akun ${isEditing ? 'diperbarui' : 'ditambahkan'}`,
          description: `${name} telah berhasil disimpan.`,
        });
        setOpen(false);
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
      setCode(account?.code || '');
      setName(account?.name || '');
      setType(account?.type || '');
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        { isDropdownItem ? <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><Edit className="mr-2 h-4 w-4" /> Edit</div> : children }
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Akun' : 'Tambah Akun Baru'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Perbarui detail akun di bawah ini.' : 'Isi detail untuk akun baru.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kode Akun</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required disabled={isPending} placeholder="Contoh: 1-10100"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nama Akun</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isPending} placeholder="Contoh: Kas Kecil"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipe Akun</Label>
                <Select onValueChange={setType} defaultValue={type} required>
                    <SelectTrigger id="type" disabled={isPending}>
                        <SelectValue placeholder="Pilih tipe akun" />
                    </SelectTrigger>
                    <SelectContent>
                        {ACCOUNT_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
