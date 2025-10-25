
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GoodsReceipt, NewSupplierInvoice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Save, FileKey2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { addSupplierInvoice } from '../actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SupplierInvoicePage() {
  const [pendingGRs, setPendingGRs] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);

  useEffect(() => {
    const q = query(collection(db, "goodsReceipts"), where("status", "==", "Pending Invoice"));
    const unsub = onSnapshot(q, (snapshot) => {
      const grs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as GoodsReceipt));
      setPendingGRs(grs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (selectedGR) {
    return <InvoiceForm gr={selectedGR} onBack={() => setSelectedGR(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Faktur Pemasok (Supplier Invoice)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Penerimaan Barang Menunggu Faktur</CardTitle>
          <CardDescription>Pilih penerimaan barang yang fakturnya sudah Anda terima dari pemasok.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tgl Terima</TableHead>
                <TableHead>No. GRN</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : pendingGRs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Tidak ada penerimaan yang menunggu faktur.</TableCell></TableRow>
              ) : (
                pendingGRs.map(gr => (
                  <TableRow key={gr.id}>
                    <TableCell>{format(gr.date, "dd MMM yyyy", { locale: id })}</TableCell>
                    <TableCell className="font-mono text-xs">{gr.id}</TableCell>
                    <TableCell>{gr.supplierName}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setSelectedGR(gr)}>
                        Buat Faktur
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

function InvoiceForm({ gr, onBack }: { gr: GoodsReceipt; onBack: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const total = gr.items.reduce((sum, item) => sum + (item.cost * item.receivedQuantity), 0);

  const handleSave = () => {
    if (!invoiceDate || !invoiceNumber) {
      toast({ title: "Data tidak lengkap", description: "Nomor dan tanggal faktur harus diisi.", variant: "destructive" });
      return;
    }

    const newInvoice: NewSupplierInvoice = {
      date: invoiceDate,
      invoiceNumber,
      goodsReceiptId: gr.id,
      purchaseOrderId: gr.purchaseOrderId,
      supplierId: gr.supplierId,
      supplierName: gr.supplierName,
      total,
    };
    
    startTransition(async () => {
      const result = await addSupplierInvoice(newInvoice);
      if (result.error) {
        toast({ title: "Gagal menyimpan faktur", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Faktur berhasil disimpan", description: `Utang usaha kepada ${gr.supplierName} telah dicatat.` });
        onBack();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" onClick={onBack} className="w-fit -ml-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Catat Faktur untuk GRN #{gr.id}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Detail Faktur</CardTitle>
          <CardDescription>
            Masukkan detail faktur dari pemasok: <span className="font-semibold">{gr.supplierName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number">Nomor Faktur Pemasok</Label>
              <Input id="invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Faktur</Label>
              <DatePicker date={invoiceDate} setDate={setInvoiceDate} />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-center">Diterima</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gr.items.map(item => (
                <TableRow key={item.productId}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-center">{item.receivedQuantity}</TableCell>
                  <TableCell className="text-right">Rp {item.cost.toLocaleString('id-ID')}</TableCell>
                  <TableCell className="text-right font-medium">Rp {(item.cost * item.receivedQuantity).toLocaleString('id-ID')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold text-lg">Total Faktur</TableCell>
                <TableCell className="text-right font-bold text-lg">Rp {total.toLocaleString('id-ID')}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending || !invoiceNumber}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileKey2 className="mr-2 h-4 w-4" />}
            Simpan & Catat Utang
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
