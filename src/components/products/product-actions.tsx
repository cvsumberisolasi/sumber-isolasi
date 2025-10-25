

'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Plus, MoreHorizontal, Loader2, Edit, Trash2, Database, PlusCircle, XCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
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
import type { Product, ProductCategory, ProductUnit, ProductType } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addProduct, updateProduct, deleteProduct, getProductsForExport } from '@/app/(app)/products/actions';
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
import { seedInitialProducts } from '@/lib/seed-actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';


export function ProductActions({ hasProducts }: { hasProducts: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExporting] = useTransition();
  const { toast } = useToast();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedInitialProducts();
      if (result.error) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Contoh data produk berhasil ditambahkan.' });
      }
    });
  };

  const handleExport = () => {
    startExporting(async () => {
        const { data, error } = await getProductsForExport();

        if (error || !data) {
            toast({ title: "Gagal Mengekspor", description: error || "Tidak dapat mengambil data produk.", variant: "destructive" });
            return;
        }

        const dataToExport = data.map(p => {
            const baseUnit = p.units?.find(u => u.conversionRate === 1) || p.units?.[0];
            return {
                'Nama Produk': p.name,
                'SKU': p.sku || '',
                'Kategori': p.category,
                'Stok': p.stock,
                'Harga Pokok': p.cost || 0,
                'Satuan Dasar': p.baseUnit,
                'Harga Jual (Satuan Dasar)': baseUnit?.price || 0,
                'Batas Stok Minimum': p.minStockThreshold || 0,
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Produk');
        XLSX.writeFile(workbook, 'Daftar_Produk.xlsx');
        
        toast({ title: "Ekspor Berhasil", description: "File Excel berhasil diunduh." });
    });
  };

  return (
     <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
             <Button variant="outline" disabled={hasProducts || isPending}>
                <Database className="mr-2 h-4 w-4" /> Seed Produk
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menambahkan beberapa contoh data produk ke database Anda.
                Tindakan ini hanya bisa dilakukan jika daftar produk Anda masih kosong.
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
        
        <Button variant="outline" onClick={handleExport} disabled={!hasProducts || isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Ekspor Excel
        </Button>
       
        <ProductFormDialog>
            <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Produk
            </Button>
        </ProductFormDialog>
    </div>
  );
}

export function ProductRowActions({ product }: { product: Product }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.error) {
        toast({
          title: 'Gagal Menghapus',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Produk Dihapus',
          description: `${product.name} telah berhasil dihapus.`,
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
           <ProductFormDialog product={product}>
             <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          </ProductFormDialog>
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
              Tindakan ini tidak dapat diurungkan. Ini akan menghapus produk
              bernama <span className="font-semibold">{product.name}</span> secara permanen.
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


export function ProductFormDialog({ children, product }: { children: React.ReactNode, product?: Product }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [category, setCategory] = useState(product?.category || '');
  const [productType, setProductType] = useState<ProductType>(product?.productType || 'Barang Dagang');
  const [stock, setStock] = useState(product?.stock || 0);
  const [cost, setCost] = useState(product?.cost || 0);
  const [minStockThreshold, setMinStockThreshold] = useState(product?.minStockThreshold || 10);
  const [units, setUnits] = useState<ProductUnit[]>(product?.units || [{ name: '', price: 0, cost: 0, conversionRate: 1 }]);
  
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productCategories"), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)));
    });
    return () => unsub();
  }, []);

  const isEditing = !!product;
  const isDropdownItem = React.isValidElement(children) && (children.type as any).displayName === 'DropdownMenuItem';
  
  const handleUnitChange = (index: number, field: keyof ProductUnit, value: string | number) => {
    const newUnits = [...units];
    const unit = newUnits[index];
    (unit[field] as any) = value;
    if (index === 0) unit.conversionRate = 1; // Base unit always has conversion rate of 1
    setUnits(newUnits);
  };

  const addUnit = () => {
    setUnits([...units, { name: '', price: 0, cost: 0, conversionRate: 0 }]);
  };

  const removeUnit = (index: number) => {
    if (units.length > 1) {
      setUnits(units.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
        toast({ title: "Kategori harus dipilih", variant: "destructive" });
        return;
    }
    if (units.some(u => !u.name || u.conversionRate <= 0 || u.price <= 0)) {
        toast({ title: "Data satuan tidak valid", description: "Nama satuan, harga, dan rasio konversi harus diisi dengan benar.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      const productData = { 
        name, 
        sku,
        category, 
        productType,
        stock,
        cost,
        minStockThreshold, 
        units, 
        baseUnit: units[0].name 
      };
      const result = isEditing 
        ? await updateProduct(product.id, productData)
        : await addProduct(productData);

      if (result.error) {
        toast({
          title: `Gagal ${isEditing ? 'memperbarui' : 'menambahkan'} produk`,
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: `Produk ${isEditing ? 'diperbarui' : 'ditambahkan'}`,
          description: `${name} telah berhasil disimpan.`,
        });
        setOpen(false);
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
      // Reset form on close
      setName(product?.name || '');
      setSku(product?.sku || '');
      setCategory(product?.category || '');
      setProductType(product?.productType || 'Barang Dagang');
      setStock(product?.stock || 0);
      setCost(product?.cost || 0);
      setMinStockThreshold(product?.minStockThreshold || 10);
      setUnits(product?.units || [{ name: '', price: 0, cost: 0, conversionRate: 1 }]);
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        { isDropdownItem ? <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><Edit className="mr-2 h-4 w-4" /> Edit</div> : children }
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Produk</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isPending}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} disabled={isPending} placeholder="Opsional"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" disabled={isPending}>
                      <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                      {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="productType">Tipe Barang</Label>
              <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
                  <SelectTrigger id="productType" disabled={isPending}>
                      <SelectValue placeholder="Pilih tipe barang" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="Barang Dagang">Barang Dagang</SelectItem>
                      <SelectItem value="Bahan Baku">Bahan Baku</SelectItem>
                      <SelectItem value="Barang Jadi">Barang Jadi</SelectItem>
                  </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="cost">Harga Pokok Satuan Dasar</Label>
              <Input id="cost" type="number" value={cost || ''} onChange={(e) => setCost(Number(e.target.value))} required disabled={isPending}/>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Satuan Produk</Label>
            <p className="text-xs text-muted-foreground">Satuan pertama akan menjadi satuan dasar (stok dihitung berdasarkan satuan ini).</p>
            <div className="border rounded-lg p-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama Satuan</TableHead>
                            <TableHead>Harga Jual</TableHead>
                            <TableHead>Konversi</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {units.map((unit, index) => (
                            <TableRow key={index}>
                                <TableCell><Input placeholder={index === 0 ? "Pcs" : "Box"} value={unit.name} onChange={e => handleUnitChange(index, 'name', e.target.value)} required/></TableCell>
                                <TableCell><Input type="number" placeholder="10000" value={unit.price || ''} onChange={e => handleUnitChange(index, 'price', Number(e.target.value))} required/></TableCell>
                                <TableCell><Input type="number" placeholder={index === 0 ? "1" : "12"} value={unit.conversionRate || ''} onChange={e => handleUnitChange(index, 'conversionRate', Number(e.target.value))} required disabled={index === 0} /></TableCell>
                                <TableCell>
                                    {index > 0 && <Button type="button" variant="ghost" size="icon" onClick={() => removeUnit(index)}><XCircle className="w-4 h-4 text-destructive" /></Button>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
             <Button type="button" variant="outline" size="sm" onClick={addUnit} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Tambah Satuan
             </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stok Awal (dalam satuan dasar)</Label>
              <Input id="stock" type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} required disabled={isEditing || isPending}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="minStockThreshold">Batas Stok Min.</Label>
              <Input id="minStockThreshold" type="number" value={minStockThreshold} onChange={(e) => setMinStockThreshold(Number(e.target.value))} required disabled={isPending}/>
            </div>
          </div>
          <DialogFooter className="pt-4">
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
