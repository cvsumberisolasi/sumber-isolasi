
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ArrowRightLeft, Loader2, Plus, Minus, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Warehouse, Product, NewStockTransfer, StockTransferItem } from '@/lib/types';
import { processStockTransfer } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function StockTransferPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [items, setItems] = useState<StockTransferItem[]>([]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    setDate(new Date());
    const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
      setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => {
      unsubWarehouses();
      unsubProducts();
    };
  }, []);

  const filteredToWarehouses = warehouses.filter(w => w.id !== fromWarehouseId);
  const filteredFromWarehouses = warehouses.filter(w => w.id !== toWarehouseId);

  const resetForm = () => {
    setDate(new Date());
    setNotes('');
    setFromWarehouseId('');
    setToWarehouseId('');
    setItems([]);
  };

  const addProductToTransfer = (product: Product) => {
    setItems(prev => {
        const existing = prev.find(i => i.productId === product.id);
        if (existing) {
            return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return [...prev, { productId: product.id, productName: product.name, quantity: 1 }];
    });
  }

  const updateQuantity = (productId: string, change: number) => {
    setItems(prev => {
        const newItems = prev.map(item => {
            if (item.productId === productId) {
                return {...item, quantity: item.quantity + change };
            }
            return item;
        });
        return newItems.filter(item => item.quantity > 0);
    });
  }

  const handleSave = () => {
    if (!fromWarehouseId || !toWarehouseId || items.length === 0 || !date) {
        toast({ title: "Data tidak lengkap", description: "Mohon isi semua field yang diperlukan.", variant: "destructive" });
        return;
    }
     if (fromWarehouseId === toWarehouseId) {
      toast({ title: "Gudang tidak valid", description: "Gudang asal dan tujuan tidak boleh sama.", variant: "destructive" });
      return;
    }
    
    const fromWarehouse = warehouses.find(w => w.id === fromWarehouseId);
    const toWarehouse = warehouses.find(w => w.id === toWarehouseId);

    if (!fromWarehouse || !toWarehouse) {
        toast({ title: "Gudang tidak valid", variant: "destructive" });
        return;
    }

    const newTransfer: NewStockTransfer = {
      date: date as Date,
      fromWarehouseId,
      fromWarehouseName: fromWarehouse.name,
      toWarehouseId,
      toWarehouseName: toWarehouse.name,
      items,
      notes,
    };
    
    startTransition(async () => {
      const result = await processStockTransfer(newTransfer);
      if (result.error) {
        toast({ title: "Gagal menyimpan transfer", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Transfer stok berhasil disimpan!" });
        resetForm();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-4xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="font-headline">Buat Catatan Transfer</CardTitle>
          <CardDescription>
            Gunakan form ini untuk mencatat perpindahan barang antar lokasi gudang internal perusahaan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-2">
                    <label>Transfer Dari (Asal)</label>
                    <Select value={fromWarehouseId} onValueChange={setFromWarehouseId} disabled={isPending}>
                    <SelectTrigger><SelectValue placeholder="Pilih gudang asal" /></SelectTrigger>
                    <SelectContent>
                        {filteredFromWarehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
                <div className="flex justify-center md:pt-6">
                    <ArrowRightLeft className="w-8 h-8 text-muted-foreground"/>
                </div>
                <div className="space-y-2">
                    <label>Transfer Ke (Tujuan)</label>
                    <Select value={toWarehouseId} onValueChange={setToWarehouseId} disabled={isPending}>
                    <SelectTrigger><SelectValue placeholder="Pilih gudang tujuan" /></SelectTrigger>
                    <SelectContent>
                        {filteredToWarehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <label>Tanggal Transfer</label>
                <DatePicker date={date} setDate={setDate} />
            </div>
            
            <div className="space-y-2">
                <label>Item yang Ditransfer</label>
                <ProductPicker products={products} onSelect={addProductToTransfer} />
                {items.length > 0 && (
                    <div className="border rounded-md mt-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produk</TableHead>
                                    <TableHead className="w-[150px]">Kuantitas</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.productId, -1)}><Minus className="h-4 w-4"/></Button>
                                                <span>{item.quantity}</span>
                                                <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.productId, 1)}><Plus className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.productId, -item.quantity)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label>Catatan</label>
                <Textarea placeholder="Catatan tambahan untuk transfer (opsional)" value={notes} onChange={e => setNotes(e.target.value)} disabled={isPending} />
            </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending || items.length === 0 || !fromWarehouseId || !toWarehouseId}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Transaksi
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


function ProductPicker({ products, onSelect }: { products: Product[], onSelect: (product: Product) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          Tambah Produk...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Cari produk..." />
          <CommandList>
            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                  {product.name} (Stok: {product.stock})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
