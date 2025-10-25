
'use client';

import React, { useState, useTransition, useEffect, useMemo } from 'react';
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
import { addBillOfMaterial, updateBillOfMaterial } from '@/app/(app)/production/actions';
import type { Product, BillOfMaterial, NewBillOfMaterial, BillOfMaterialItem, Account, AdditionalCostItem } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, Edit } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductFormDialog } from '../products/product-actions';
import { Separator } from '../ui/separator';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface BomFormDialogProps {
  children: React.ReactNode;
  products: Product[];
  bom?: BillOfMaterial;
}

export function BomFormDialog({ children, products, bom }: BomFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [finishedGoodId, setFinishedGoodId] = useState(bom?.productId || '');
  const [quantityProduced, setQuantityProduced] = useState(bom?.quantityProduced || 1);
  const [items, setItems] = useState<BillOfMaterialItem[]>(bom?.items || []);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostItem[]>(bom?.additionalCosts || []);

  const [accounts, setAccounts] = useState<Account[]>([]);
  
  useEffect(() => {
    const q = query(collection(db, 'coa'), where('type', 'in', ['Beban Operasional', 'Beban Lainnya']));
    const unsub = onSnapshot(q, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });
    return () => unsub();
  }, []);

  const finishedGoods = useMemo(() => products.filter(p => Array.isArray(p.productType) && p.productType.includes('Barang Jadi')), [products]);
  const rawMaterials = useMemo(() => products.filter(p => Array.isArray(p.productType) && p.productType.includes('Bahan Baku')), [products]);

  const isEditing = !!bom;
  const isDropdownItem = React.isValidElement(children) && (children.type as any).displayName === 'DropdownMenuItem';

  const handleAddItem = (type: 'material' | 'cost') => {
    if (type === 'material') {
      setItems(prev => [...prev, { productId: '', productName: '', quantity: 0, unit: '' }]);
    } else {
      setAdditionalCosts(prev => [...prev, { accountId: '', accountName: '', amount: 0 }]);
    }
  };

  const handleItemChange = (index: number, field: keyof BillOfMaterialItem, value: string | number) => {
    setItems(prev => {
      const newItems = [...prev];
      if (field === 'productId') {
        const product = rawMaterials.find(p => p.id === value);
        newItems[index] = { ...newItems[index], productId: value as string, productName: product?.name || '', unit: product?.baseUnit || '' };
      } else {
        (newItems[index] as any)[field] = value;
      }
      return newItems;
    });
  };

  const handleCostChange = (index: number, field: keyof AdditionalCostItem, value: string | number) => {
    setAdditionalCosts(prev => {
      const newCosts = [...prev];
      if (field === 'accountId') {
        const account = accounts.find(a => a.id === value);
        newCosts[index] = { ...newCosts[index], accountId: value as string, accountName: account?.name || '' };
      } else {
        (newCosts[index] as any)[field] = value;
      }
      return newCosts;
    });
  };

  const handleRemoveItem = (index: number, type: 'material' | 'cost') => {
    if (type === 'material') {
      setItems(prev => prev.filter((_, i) => i !== index));
    } else {
      setAdditionalCosts(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  const resetForm = () => {
    setFinishedGoodId(bom?.productId || '');
    setQuantityProduced(bom?.quantityProduced || 1);
    setItems(bom?.items || []);
    setAdditionalCosts(bom?.additionalCosts || []);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
        resetForm();
    }
    setOpen(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishedGoodId || items.length === 0) {
      toast({ title: 'Data tidak lengkap', description: 'Produk jadi dan minimal satu bahan baku harus diisi.', variant: 'destructive' });
      return;
    }
    
    const finishedGood = finishedGoods.find(p => p.id === finishedGoodId);
    if (!finishedGood) {
      toast({ title: 'Produk jadi tidak valid', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const data: NewBillOfMaterial = {
        productId: finishedGoodId,
        productName: finishedGood.name,
        quantityProduced,
        items,
        additionalCosts,
      };

      const result = isEditing
        ? await updateBillOfMaterial(bom.id, data)
        : await addBillOfMaterial(data);

      if (result.error) {
        toast({ title: `Gagal menyimpan`, description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `Formula berhasil disimpan.` });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isDropdownItem ? (
          <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </div>
        ) : (
          children
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Formula Produksi' : 'Buat Formula Produksi'}</DialogTitle>
          <DialogDescription>
            Tentukan resep untuk menghasilkan sebuah barang jadi dari beberapa bahan baku.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="finishedGood">Produk Hasil (Output)</Label>
              <Select value={finishedGoodId} onValueChange={setFinishedGoodId} required>
                <SelectTrigger id="finishedGood" disabled={isPending}>
                  <SelectValue placeholder="Pilih produk jadi..." />
                </SelectTrigger>
                <SelectContent>
                  {finishedGoods.length === 0 ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      Belum ada produk bertipe "Barang Jadi".
                    </div>
                  ) : (
                    finishedGoods.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))
                  )}
                  <Separator className="my-1"/>
                   <ProductFormDialog>
                      <div onSelect={(e) => e.preventDefault()} className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                        <PlusCircle className="mr-2 h-4 w-4"/> Tambah Produk Jadi Baru...
                      </div>
                  </ProductFormDialog>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="quantityProduced">Jumlah Dihasilkan</Label>
                <Input id="quantityProduced" type="number" value={quantityProduced} onChange={(e) => setQuantityProduced(Number(e.target.value))} onFocus={(e) => e.target.select()} required disabled={isPending} />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Bahan Baku (Input)</Label>
            <div className="border rounded-lg p-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Bahan Baku</TableHead>
                            <TableHead className="w-28">Kuantitas</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Select value={item.productId} onValueChange={(v) => handleItemChange(index, 'productId', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih bahan..."/></SelectTrigger>
                                        <SelectContent>
                                            {rawMaterials.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input type="number" value={item.quantity || ''} onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))} onFocus={(e) => e.target.select()}/>
                                </TableCell>
                                <TableCell>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'material')}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem('material')}>
                <PlusCircle className="mr-2 h-4 w-4"/> Tambah Bahan Baku
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label>Biaya Tambahan (Tenaga Kerja, Overhead, dll)</Label>
            <div className="border rounded-lg p-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Akun Biaya</TableHead>
                            <TableHead className="w-40">Jumlah (Rp)</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {additionalCosts.map((cost, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Select value={cost.accountId} onValueChange={(v) => handleCostChange(index, 'accountId', v)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih akun biaya..."/></SelectTrigger>
                                        <SelectContent>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input type="number" value={cost.amount || ''} onChange={e => handleCostChange(index, 'amount', Number(e.target.value))} onFocus={(e) => e.target.select()}/>
                                </TableCell>
                                <TableCell>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index, 'cost')}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem('cost')}>
                <PlusCircle className="mr-2 h-4 w-4"/> Tambah Biaya
            </Button>
          </div>


          <DialogFooter className="pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Formula
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
