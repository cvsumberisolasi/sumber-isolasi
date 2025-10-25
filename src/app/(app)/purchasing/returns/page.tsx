
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GoodsReceipt, PurchaseReturnItem, NewPurchaseReturn } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Save, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { processPurchaseReturn } from '../actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function PurchaseReturnsPage() {
  const [invoicedGRs, setInvoicedGRs] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);

  useEffect(() => {
    const q = query(collection(db, "goodsReceipts"), where("status", "==", "Invoiced"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const grs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as GoodsReceipt));
      setInvoicedGRs(grs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (selectedGR) {
    return <PurchaseReturnForm gr={selectedGR} onBack={() => setSelectedGR(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Retur Pembelian</h1>
      <Card>
        <CardHeader>
          <CardTitle>Mulai Proses Retur</CardTitle>
          <CardDescription>Pilih penerimaan barang (GRN) yang itemnya ingin Anda kembalikan ke pemasok.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tgl Terima</TableHead>
                <TableHead>No. GRN</TableHead>
                <TableHead>Pemasok</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : invoicedGRs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Tidak ada penerimaan barang yang bisa diretur.</TableCell></TableRow>
              ) : (
                invoicedGRs.map(gr => (
                  <TableRow key={gr.id}>
                    <TableCell>{format(gr.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{gr.id}</TableCell>
                    <TableCell>{gr.supplierName}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setSelectedGR(gr)}>
                        <Truck className="mr-2 h-4 w-4" /> Buat Retur
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PurchaseReturnForm({ gr, onBack }: { gr: GoodsReceipt; onBack: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [returnDate, setReturnDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<PurchaseReturnItem[]>(() =>
    gr.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.receivedQuantity, // max returnable quantity
      returnQuantity: 0,
      cost: item.cost,
    }))
  );

  const handleQuantityChange = (productId: string, value: string) => {
    const returnQuantity = Number(value);
    setItems(prevItems =>
      prevItems.map(item =>
        item.productId === productId ? { ...item, returnQuantity: isNaN(returnQuantity) ? 0 : returnQuantity } : item
      )
    );
  };
  
  const totalReturnValue = useMemo(() => {
      return items.reduce((sum, item) => sum + item.cost * (item.returnQuantity || 0), 0);
  }, [items]);

  const handleSave = () => {
    if (!returnDate || !reason) {
      toast({ title: "Data tidak lengkap", description: "Tanggal dan alasan retur harus diisi.", variant: "destructive" });
      return;
    }
    
    const returnedItems = items.filter(item => item.returnQuantity > 0);
    if (returnedItems.length === 0) {
      toast({ title: "Tidak ada barang yang diretur", description: "Masukkan jumlah barang yang akan diretur.", variant: "destructive" });
      return;
    }
    
    if (returnedItems.some(item => item.returnQuantity > item.quantity)) {
        toast({ title: "Jumlah retur melebihi jumlah diterima", variant: "destructive" });
        return;
    }

    const newReturn: NewPurchaseReturn = {
      date: returnDate,
      goodsReceiptId: gr.id,
      supplierId: gr.supplierId,
      supplierName: gr.supplierName,
      items: returnedItems.map(({ quantity, ...rest }) => ({...rest})), // remove original quantity
      total: totalReturnValue,
      reason,
    };
    
    startTransition(async () => {
      const result = await processPurchaseReturn(newReturn);
      if (result.error) {
        toast({ title: "Gagal menyimpan retur", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Retur pembelian berhasil disimpan", description: `Stok produk & utang telah diperbarui.` });
        onBack();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" onClick={onBack} className="w-fit -ml-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Retur Pembelian dari GRN #{gr.id}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Detail Retur</CardTitle>
          <CardDescription>
            Pilih item dan jumlah yang akan dikembalikan ke pemasok: <span className="font-semibold">{gr.supplierName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Retur</label>
              <DatePicker date={returnDate} setDate={setReturnDate} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Alasan Retur</label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: Barang rusak saat diterima"/>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Diterima</TableHead>
                <TableHead className="w-[150px] text-center">Diretur</TableHead>
                <TableHead className="text-right">Subtotal Retur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.productId}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.returnQuantity}
                      onChange={e => handleQuantityChange(item.productId, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      max={item.quantity}
                      min={0}
                      className="text-center"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">Rp {(item.cost * (item.returnQuantity || 0)).toLocaleString('id-ID')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex flex-col items-end gap-4">
            <div className="text-lg font-bold">
                Total Nilai Retur: Rp {totalReturnValue.toLocaleString('id-ID')}
            </div>
            <p className="text-sm text-muted-foreground -mt-2">
                Nilai ini akan mengurangi utang usaha Anda kepada pemasok.
            </p>
          <Button onClick={handleSave} disabled={isPending || totalReturnValue <= 0 || !reason}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Retur
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
