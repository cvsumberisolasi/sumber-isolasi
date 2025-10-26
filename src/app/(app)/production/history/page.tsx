
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductionCompletion } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ProductionHistoryPage() {
  const [completions, setCompletions] = useState<ProductionCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompletion, setSelectedCompletion] = useState<ProductionCompletion | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'productionCompletions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCompletions(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      } as ProductionCompletion)));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <Dialog onOpenChange={(open) => !open && setSelectedCompletion(null)}>
      <div className="flex flex-col gap-6">
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-headline font-bold">Riwayat Penyelesaian Produksi</h2>
          <p className="text-muted-foreground text-sm">Daftar semua proses produksi yang telah selesai.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Produksi</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Selesai</TableHead>
                  <TableHead>Produk Jadi</TableHead>
                  <TableHead>No. WO</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Total Biaya Produksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                ) : completions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Belum ada riwayat produksi.</TableCell></TableRow>
                ) : (
                  completions.map(pc => (
                    <DialogTrigger asChild key={pc.id}>
                        <TableRow className="cursor-pointer" onClick={() => setSelectedCompletion(pc)}>
                            <TableCell>{format(pc.date, "dd MMM yyyy, HH:mm", { locale: id })}</TableCell>
                            <TableCell className="font-medium">{pc.finishedGoodName}</TableCell>
                            <TableCell className="font-mono text-xs">{pc.workOrderId}</TableCell>
                            <TableCell className="text-right">{pc.quantityProduced} unit</TableCell>
                            <TableCell className="text-right font-mono">Rp {pc.totalCost.toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                    </DialogTrigger>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       {selectedCompletion && (
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detail Produksi: {selectedCompletion.id}</DialogTitle>
                    <DialogDescription>
                        Menampilkan rincian bahan baku dan biaya yang digunakan untuk produksi {selectedCompletion.finishedGoodName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">Bahan Baku Terpakai</h4>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bahan Baku</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedCompletion.consumedItems.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2">Biaya Tambahan</h4>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Akun Biaya</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedCompletion.additionalCosts.length > 0 ? (
                                    selectedCompletion.additionalCosts.map((cost, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{cost.accountName}</TableCell>
                                            <TableCell className="text-right font-mono">Rp {cost.amount.toLocaleString('id-ID')}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Tidak ada biaya tambahan.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
       )}
    </Dialog>
  );
}
