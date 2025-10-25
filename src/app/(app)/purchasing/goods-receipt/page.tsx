
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PurchaseOrder, GoodsReceipt, NewGoodsReceipt, GoodsReceiptItem, Account, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addGoodsReceipt } from '../actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';

export default function GoodsReceiptPage() {
  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    const poQuery = query(collection(db, "purchaseOrders"), where("status", "==", "Sent"));
    const poUnsub = onSnapshot(poQuery, (snapshot) => {
      const pos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as PurchaseOrder));
      setOpenPOs(pos);
      setLoading(false);
    });

    const grQuery = query(collection(db, "goodsReceipts"), orderBy("date", "desc"));
    const grUnsub = onSnapshot(grQuery, (snapshot) => {
        const grs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate()
        } as GoodsReceipt));
        setGoodsReceipts(grs);
    });

    return () => {
      poUnsub();
      grUnsub();
    };
  }, []);

  if (selectedPO) {
    return <GoodsReceiptForm po={selectedPO} onBack={() => setSelectedPO(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Penerimaan Barang (Goods Receipt)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Daftar Pesanan Pembelian Terbuka</CardTitle>
          <CardDescription>Pilih PO yang barangnya sudah diterima untuk dicatat.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal PO</TableHead>
                <TableHead>No. PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : openPOs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Tidak ada PO yang sedang berjalan.</TableCell></TableRow>
              ) : (
                openPOs.map(po => (
                  <TableRow key={po.id}>
                    <TableCell>{format(po.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{po.id}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell className="text-right font-medium">Rp {po.total.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setSelectedPO(po)}>
                        Proses Penerimaan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle>Riwayat Penerimaan Barang</CardTitle>
              <CardDescription>Daftar barang yang telah diterima dari supplier.</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Tgl Terima</TableHead>
                          <TableHead>No. GRN</TableHead>
                          <TableHead>Referensi PO</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Status</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {goodsReceipts.map(gr => (
                          <TableRow key={gr.id}>
                              <TableCell>{format(gr.date, "dd MMM yyyy")}</TableCell>
                              <TableCell className="font-mono text-xs">{gr.id}</TableCell>
                              <TableCell className="font-mono text-xs">{gr.purchaseOrderId}</TableCell>
                              <TableCell>{gr.supplierName}</TableCell>
                              <TableCell><Badge variant={gr.status === 'Invoiced' ? 'secondary' : 'outline'}>{gr.status}</Badge></TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>

    </div>
  );
}


function GoodsReceiptForm({ po, onBack }: { po: PurchaseOrder; onBack: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());
  const [items, setItems] = useState<GoodsReceiptItem[]>(() => 
    po.items.map(item => ({ ...item, receivedQuantity: item.quantity }))
  );

  const handleQuantityChange = (productId: string, value: string) => {
    const receivedQuantity = Number(value);
    setItems(prevItems => 
      prevItems.map(item => 
        item.productId === productId ? { ...item, receivedQuantity: isNaN(receivedQuantity) ? 0 : receivedQuantity } : item
      )
    );
  };

  const handleSave = () => {
    if (!receiptDate) {
      toast({ title: "Tanggal penerimaan harus diisi", variant: "destructive" });
      return;
    }

    const receivedItems = items.filter(item => item.receivedQuantity > 0);
    if (receivedItems.length === 0) {
      toast({ title: "Tidak ada barang yang diterima", description: "Masukkan jumlah barang yang diterima.", variant: "destructive" });
      return;
    }
     if (receivedItems.some(item => item.receivedQuantity > item.quantity)) {
        toast({ title: "Jumlah diterima melebihi pesanan", variant: "destructive" });
        return;
    }


    const newGR: NewGoodsReceipt = {
      date: receiptDate,
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      items: receivedItems,
    };
    
    startTransition(async () => {
      const result = await addGoodsReceipt(newGR, po.id);
      if (result.error) {
        toast({ title: "Gagal menyimpan penerimaan", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Penerimaan barang berhasil disimpan", description: `Stok produk telah diperbarui.` });
        onBack();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <Button variant="ghost" onClick={onBack} className="mb-2 -ml-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <h1 className="text-2xl md:text-3xl font-headline font-bold">Penerimaan Barang dari PO #{po.id}</h1>
            </div>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Detail Penerimaan</CardTitle>
          <CardDescription>
            Konfirmasi jumlah barang yang diterima dari supplier: <span className="font-semibold">{po.supplierName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="max-w-xs">
                <label className="text-sm font-medium">Tanggal Penerimaan</label>
                <DatePicker date={receiptDate} setDate={setReceiptDate} />
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-center">Dipesan</TableHead>
                        <TableHead className="w-[150px] text-center">Diterima</TableHead>
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
                                    value={item.receivedQuantity}
                                    onChange={e => handleQuantityChange(item.productId, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    max={item.quantity}
                                    className="text-center"
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan & Update Stok
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
