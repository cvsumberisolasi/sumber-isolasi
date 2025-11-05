
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, ArrowRight } from 'lucide-react';
import { collection, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ParkedTransaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
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
} from '@/components/ui/alert-dialog';

export default function ParkedTransactionsPage() {
  const [parkedTxs, setParkedTxs] = useState<ParkedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'parkedTransactions'), (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      } as ParkedTransaction)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setParkedTxs(txs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleResume = (tx: ParkedTransaction) => {
    // Save to local storage and redirect
    localStorage.setItem('resumedCart', JSON.stringify(tx.cart));
    router.push('/pos');
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteDoc(doc(db, 'parkedTransactions', id));
        toast({ title: 'Transaksi diparkir berhasil dihapus.' });
      } catch (error) {
        const e = error as Error;
        toast({ title: 'Gagal menghapus', description: e.message, variant: 'destructive' });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Transaksi Terparkir</h1>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Keranjang Tersimpan</CardTitle>
          <CardDescription>Pilih transaksi untuk dilanjutkan atau dihapus.</CardDescription>
        </CardHeader>
        <CardContent>
          {parkedTxs.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Tidak ada transaksi yang diparkir.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {parkedTxs.map(tx => (
                <Card key={tx.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{tx.name}</CardTitle>
                    <CardDescription>
                      Disimpan pada: {tx.createdAt.toLocaleString('id-ID')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul>
                      {tx.cart.map(item => (
                        <li key={item.product.id} className="flex justify-between text-sm">
                          <span>{item.product.name} x {item.quantity}</span>
                          <span>Rp {(item.unit.price * item.quantity).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isPending}>
                          <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini akan menghapus keranjang yang diparkir secara permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(tx.id)}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Hapus'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button size="sm" onClick={() => handleResume(tx)}>
                      Lanjutkan <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
