
'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Warehouse, StockOpname, StockOpnameItem as OpnameDetailItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, AlertTriangle, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processStockOpname } from './actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

type OpnameItem = {
  product: Product;
  physicalCount: number | null;
}

export default function StockOpnamePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [opnameItems, setOpnameItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [opnameDate, setOpnameDate] = useState<Date|undefined>();
  const [notes, setNotes] = useState('');
  
  const [opnameHistory, setOpnameHistory] = useState<StockOpname[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    setOpnameDate(new Date());
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productList);
      setOpnameItems(productList.map(p => ({ product: p, physicalCount: null })));
      setLoading(false);
    });
    
    const unsubWarehouses = onSnapshot(query(collection(db, 'warehouses'), orderBy('name')), (snapshot) => {
        setWarehouses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
    });

    const unsubHistory = onSnapshot(query(collection(db, 'stockOpnames'), orderBy('date', 'desc')), (snapshot) => {
      setOpnameHistory(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as StockOpname)))
      setLoadingHistory(false);
    });

    return () => {
        unsubProducts();
        unsubWarehouses();
        unsubHistory();
    };
  }, []);

  const handleCountChange = (productId: string, count: string) => {
    const value = count === '' ? null : Number(count);
    setOpnameItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, physicalCount: value } : item
    ));
  };
  
  const handleCheckboxChange = (productId: string, checked: boolean) => {
    setOpnameItems(prev => prev.map(item => {
        if (item.product.id === productId) {
            return {
                ...item,
                physicalCount: checked ? item.product.stock : null
            };
        }
        return item;
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    setOpnameItems(prev => prev.map(item => ({
        ...item,
        physicalCount: checked ? item.product.stock : null
    })));
  };

  const allCheckedState = useMemo(() => {
    if (opnameItems.length === 0) return 'none';
    const checkedCount = opnameItems.filter(item => item.physicalCount === item.product.stock).length;
    if (checkedCount === 0) return 'none';
    if (checkedCount === opnameItems.length) return 'all';
    return 'some';
  }, [opnameItems]);

  const processedItems = useMemo(() => {
    return opnameItems
      .filter(item => item.physicalCount !== null)
      .map(item => {
        const difference = (item.physicalCount as number) - item.product.stock;
        const differenceValue = difference * (item.product.cost || 0);
        return {
            product: item.product,
            physicalCount: item.physicalCount as number,
            difference,
            differenceValue
        }
    }).filter(item => item.difference !== 0);
  }, [opnameItems]);

  const hasCountedItems = useMemo(() => {
    return opnameItems.some(item => item.physicalCount !== null);
  }, [opnameItems]);


  const totalAdjustmentValue = useMemo(() => {
    return processedItems.reduce((sum, item) => sum + item.differenceValue, 0);
  }, [processedItems]);

  const handleSave = () => {
    if (!hasCountedItems) {
      toast({ title: "Belum ada item dihitung", description: "Mohon isi jumlah stok fisik setidaknya untuk satu produk.", variant: "destructive" });
      return;
    }
     if (!opnameDate || !selectedWarehouseId) {
        toast({ title: "Data tidak lengkap", description: "Tanggal opname dan gudang harus diisi.", variant: "destructive" });
        return;
    }

    const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
    if (!warehouse) return;

    startTransition(async () => {
        const result = await processStockOpname(processedItems, opnameDate, notes, warehouse.id, warehouse.name);
        if (result.error) {
            toast({ title: "Gagal menyimpan penyesuaian", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Penyesuaian stok berhasil", description: "Stok produk dan jurnal akuntansi telah diperbarui." });
            resetForm();
        }
    })
  }

  const resetForm = () => {
    setOpnameItems(products.map(p => ({ product: p, physicalCount: null })));
    setNotes('');
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Penyesuaian Stok (Stock Opname)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sesi Stock Opname</CardTitle>
          <CardDescription>Masukkan jumlah stok fisik hasil perhitungan di gudang. Kosongkan jika tidak ada perubahan, atau centang "Sesuai" jika jumlahnya sama dengan sistem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Gudang</Label>
                    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                        <SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
                        <SelectContent>
                            {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Tanggal Opname</Label>
                    <DatePicker date={opnameDate} setDate={setOpnameDate} />
                </div>
                 <div className="space-y-2">
                    <Label>Catatan/Referensi</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: Opname Bulanan" />
                </div>
            </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Stok Sistem</TableHead>
                  <TableHead className="w-[150px] text-center">Stok Fisik</TableHead>
                  <TableHead className="text-center">Selisih</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                       Sesuai
                       <Checkbox
                          id="check-all"
                          checked={allCheckedState === 'all'}
                          onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                          aria-label="Pilih Semua"
                          data-state={allCheckedState === 'some' ? 'indeterminate' : allCheckedState === 'all' ? 'checked' : 'unchecked'}
                       />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                ) : opnameItems.map(item => (
                  <TableRow key={item.product.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-center">{item.product.stock}</TableCell>
                    <TableCell>
                      <Input 
                        type="number"
                        placeholder={String(item.product.stock)}
                        value={item.physicalCount ?? ''}
                        onChange={e => handleCountChange(item.product.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="text-center"
                        disabled={item.physicalCount === item.product.stock}
                      />
                    </TableCell>
                    <TableCell className={cn(
                        "text-center font-bold",
                        ((item.physicalCount ?? item.product.stock) - item.product.stock) > 0 && "text-green-600",
                        ((item.physicalCount ?? item.product.stock) - item.product.stock) < 0 && "text-destructive",
                    )}>
                      { item.physicalCount !== null ? item.physicalCount - item.product.stock : '-' }
                    </TableCell>
                    <TableCell className="text-center">
                        <Checkbox 
                            id={`check-${item.product.id}`}
                            checked={item.physicalCount === item.product.stock}
                            onCheckedChange={(checked) => handleCheckboxChange(item.product.id, Boolean(checked))}
                        />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-muted text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <div>
                    <p>Total Nilai Penyesuaian: <span className="font-bold">Rp {totalAdjustmentValue.toLocaleString('id-ID')}</span></p>
                    <p>Nilai ini akan dijurnal sebagai penyesuaian HPP/persediaan.</p>
                </div>
            </div>
            <Button onClick={handleSave} disabled={isPending || !hasCountedItems}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Penyesuaian
            </Button>
        </CardFooter>
      </Card>
      <OpnameHistoryList history={opnameHistory} loading={loadingHistory} />
    </div>
  );
}


function OpnameHistoryList({ history, loading }: { history: StockOpname[], loading: boolean }) {
  const [selectedOpname, setSelectedOpname] = useState<StockOpname | null>(null);

  return (
    <Dialog open={!!selectedOpname} onOpenChange={(open) => !open && setSelectedOpname(null)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History/>Riwayat Stock Opname</CardTitle>
          <CardDescription>Daftar sesi penyesuaian stok yang telah selesai.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Gudang</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Nilai Penyesuaian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin"/></TableCell></TableRow>
              ) : history.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Belum ada riwayat stock opname.</TableCell></TableRow>
              ) : (
                history.map(item => (
                  <DialogTrigger key={item.id} asChild>
                    <TableRow className="cursor-pointer" onClick={() => setSelectedOpname(item)}>
                      <TableCell>{format(item.date, "dd MMM yyyy", { locale: id })}</TableCell>
                      <TableCell>{item.warehouseName}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.notes}</TableCell>
                      <TableCell className={cn("text-right font-mono", item.totalAdjustmentValue !== 0 && (item.totalAdjustmentValue > 0 ? "text-green-600" : "text-destructive"))}>
                        Rp {item.totalAdjustmentValue.toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  </DialogTrigger>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {selectedOpname && (
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail Stock Opname #{selectedOpname.id.substring(0,8)}</DialogTitle>
            <DialogDescription>
              {format(selectedOpname.date, "dd MMMM yyyy", { locale: id })} - Gudang: {selectedOpname.warehouseName}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Stok Sistem</TableHead>
                  <TableHead className="text-center">Stok Fisik</TableHead>
                  <TableHead className="text-center">Selisih</TableHead>
                  <TableHead className="text-right">Nilai Selisih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOpname.items.map(item => (
                  <TableRow key={item.productId}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-center">{item.systemStock}</TableCell>
                    <TableCell className="text-center">{item.physicalCount}</TableCell>
                    <TableCell className={cn("text-center font-bold", item.difference > 0 && "text-green-600", item.difference < 0 && "text-destructive")}>
                        {item.difference}
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.differenceValue.toLocaleString('id-ID')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
