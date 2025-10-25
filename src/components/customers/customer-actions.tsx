
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
import type { Customer } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addCustomer, updateCustomer, deleteCustomer } from '@/app/(app)/customers/actions';
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
import { seedInitialCustomers } from '@/lib/seed-actions';
import { Textarea } from '../ui/textarea';


export function CustomerActions({ hasCustomers }: { hasCustomers: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedInitialCustomers();
      if (result.error) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Contoh data pelanggan berhasil ditambahkan.' });
      }
    });
  }

  return (
     <div className="flex flex-col sm:flex-row gap-2 w-full">
        <AlertDialog>
          <AlertDialogTrigger asChild>
             <Button variant="outline" className="w-full" disabled={hasCustomers || isPending}>
                <Database className="mr-2 h-4 w-4" /> Seed Pelanggan
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menambahkan beberapa contoh data pelanggan ke database Anda.
                Tindakan ini hanya bisa dilakukan jika daftar pelanggan Anda masih kosong.
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
       
        <CustomerFormDialog>
            <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Pelanggan
            </Button>
        </CustomerFormDialog>
    </div>
  );
}

export function CustomerRowActions({ customer }: { customer: Customer }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if (result.error) {
        toast({
          title: 'Gagal Menghapus',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pelanggan Dihapus',
          description: `${customer.name} telah berhasil dihapus.`,
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
             <CustomerFormDialog customer={customer}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
            </CustomerFormDialog>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anda yakin?</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat diurungkan. Ini akan menghapus data pelanggan 
              bernama <span className="font-semibold">{customer.name}</span> secara permanen.
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

function CustomerFormDialog({ children, customer }: { children: React.ReactNode, customer?: Customer }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [name, setName] = useState(customer?.name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  
  const isEditing = !!customer;
  const isDropdownItem = React.isValidElement(children) && (children.type as any).displayName === 'DropdownMenuItem';


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const customerData = { name, email, phone, address };
      const result = isEditing
        ? await updateCustomer(customer.id, customerData)
        : await addCustomer(customerData);

      if (result.error) {
        toast({
          title: `Gagal ${isEditing ? 'memperbarui' : 'menambahkan'} pelanggan`,
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: `Pelanggan ${isEditing ? 'diperbarui' : 'ditambahkan'}`,
          description: `${name} telah berhasil disimpan.`,
        });
        setOpen(false);
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
      setName(customer?.name || '');
      setEmail(customer?.email || '');
      setPhone(customer?.phone || '');
      setAddress(customer?.address || '');
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
          <DialogTitle className="font-headline">{isEditing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Perbarui detail pelanggan di bawah ini.' : 'Isi detail untuk pelanggan baru.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Pelanggan</Label>
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
