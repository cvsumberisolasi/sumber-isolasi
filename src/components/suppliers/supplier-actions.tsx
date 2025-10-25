
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
import type { Supplier } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '../ui/textarea';
import { addSupplier, updateSupplier, deleteSupplier } from '@/app/(app)/suppliers/actions';
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
import { seedInitialSuppliers } from '@/lib/seed-actions';


export function SupplierActions({ hasSuppliers }: { hasSuppliers: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedInitialSuppliers();
      if (result.error) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Contoh data pemasok berhasil ditambahkan.' });
      }
    });
  }

  return (
     <div className="flex flex-col sm:flex-row gap-2 w-full">
        <AlertDialog>
          <AlertDialogTrigger asChild>
             <Button variant="outline" className="w-full" disabled={hasSuppliers || isPending}>
                <Database className="mr-2 h-4 w-4" /> Seed Pemasok
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menambahkan beberapa contoh data pemasok ke database Anda.
                Tindakan ini hanya bisa dilakukan jika daftar pemasok Anda masih kosong.
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
       
        <SupplierFormDialog>
            <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Pemasok
            </Button>
        </SupplierFormDialog>
    </div>
  );
}

export function SupplierRowActions({ supplier }: { supplier: Supplier }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteSupplier(supplier.id);
      if (result.error) {
        toast({
          title: 'Gagal Menghapus',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Supplier Dihapus',
          description: `${supplier.name} telah berhasil dihapus.`,
        });
        setIsDeleteDialogOpen(false);
      }
    });
  };

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
          <SupplierFormDialog supplier={supplier}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          </SupplierFormDialog>
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
              Tindakan ini tidak dapat diurungkan. Ini akan menghapus supplier
              bernama <span className="font-semibold">{supplier.name}</span> secara permanen.
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

function SupplierFormDialog({ children, supplier }: { children: React.ReactNode, supplier?: Supplier }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [name, setName] = useState(supplier?.name || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [address, setAddress] = useState(supplier?.address || '');

  const isEditing = !!supplier;
  const isDropdownItem = React.isValidElement(children) && (children.type as any).displayName === 'DropdownMenuItem';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const supplierData = { name, email, phone, address };
      const result = isEditing
        ? await updateSupplier(supplier.id, supplierData)
        : await addSupplier(supplierData);

      if (result.error) {
        toast({
          title: `Gagal ${isEditing ? 'memperbarui' : 'menambahkan'} supplier`,
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: `Supplier ${isEditing ? 'diperbarui' : 'ditambahkan'}`,
          description: `${name} telah berhasil disimpan.`,
        });
        setOpen(false);
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
      setName(supplier?.name || '');
      setEmail(supplier?.email || '');
      setPhone(supplier?.phone || '');
      setAddress(supplier?.address || '');
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        { isDropdownItem ? <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><Edit className="mr-2 h-4 w-4" /> Edit</div> : children }
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Supplier' : 'Tambah Supplier Baru'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Perbarui detail supplier di bawah ini.' : 'Isi detail untuk supplier baru.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Supplier</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isPending} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Alamat</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={isPending} />
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
