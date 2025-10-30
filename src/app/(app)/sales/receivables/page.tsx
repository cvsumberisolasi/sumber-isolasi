

'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, startAfter, DocumentData, getDocs, Query, endBefore, limitToLast } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Account } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, ReceiptText, CheckCircle2, ArrowLeft, ArrowRight, HandCoins } from 'lucide-react';
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
import { settleReceivable, settleMultipleReceivables } from '@/app/(app)/pos/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';


const TRANSACTIONS_PER_PAGE = 500;

function SettleReceivableDialog({ transaction, onSettled }: { transaction: Transaction, onSettled: () => void }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, 'coa'), where('type', '==', 'Kas & Bank'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCashBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });
        return () => unsubscribe();
    }, [open]);

    const handleSettle = () => {
        if (!paymentAccountId) {
            toast({ title: 'Akun pembayaran harus dipilih', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            try {
                await settleReceivable(transaction.id, paymentAccountId);
                toast({ title: 'Piutang berhasil dilunasi!', description: `Transaksi #${transaction.id} telah diperbarui.` });
                onSettled();
                setOpen(false);
            } catch (error) {
                const e = error as Error;
                toast({ title: 'Gagal melunasi piutang', description: e.message, variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                    <HandCoins className="mr-2 h-4 w-4" /> Tandai Lunas
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pelunasan Piutang</DialogTitle>
                    <DialogDescription>
                        Anda akan melunasi transaksi #{transaction.id} sebesar Rp {(transaction.grandTotal || transaction.total).toLocaleString('id-ID', { maximumFractionDigits: 0 })}. Pilih akun bank/kas tujuan penerimaan dana.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <Label htmlFor="payment-account">Akun Penerimaan Pembayaran</Label>
                    <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                        <SelectTrigger id="payment-account">
                            <SelectValue placeholder="Pilih akun kas/bank..." />
                        </SelectTrigger>
                        <SelectContent>
                            {cashBankAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
                    <Button onClick={handleSettle} disabled={isPending || !paymentAccountId}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Konfirmasi Lunas'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MultiSettleDialog({ transactionIds, onSettled }: { transactionIds: string[], onSettled: () => void }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, 'coa'), where('type', '==', 'Kas & Bank'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCashBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });
        return () => unsubscribe();
    }, [open]);

    const handleSettle = () => {
        if (!paymentAccountId) {
            toast({ title: 'Akun pembayaran harus dipilih', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await settleMultipleReceivables(transactionIds, paymentAccountId);
            if (result.error) {
                toast({ title: 'Gagal melunasi piutang', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Piutang berhasil dilunasi!', description: `${transactionIds.length} transaksi telah diperbarui.` });
                onSettled();
                setOpen(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                 <Button>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Lakukan Pelunasan
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pelunasan Piutang Massal</DialogTitle>
                    <DialogDescription>
                        Anda akan melunasi {transactionIds.length} transaksi terpilih. Pilih akun bank/kas tujuan penerimaan dana.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <Label htmlFor="payment-account">Akun Penerimaan Pembayaran</Label>
                    <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                        <SelectTrigger id="payment-account">
                            <SelectValue placeholder="Pilih akun kas/bank..." />
                        </SelectTrigger>
                        <SelectContent>
                            {cashBankAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
                    <Button onClick={handleSettle} disabled={isPending || !paymentAccountId}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Konfirmasi Lunas'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AccountsReceivablePage() {
  const [receivables, setReceivables] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalReceivables, setTotalReceivables] = useState(0);

  const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);
  const [firstVisible, setFirstVisible] = useState<DocumentData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  
  const [selectedRows, setSelectedRows] = useState<string[]>([]);


  useEffect(() => {
    // Listener for total receivables amount
    const qTotal = query(collection(db, 'transactions'), where('status', '==', 'Belum Lunas'));
    const unsubTotal = onSnapshot(qTotal, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        const tx = doc.data() as Transaction;
        total += tx.grandTotal || tx.total;
      });
      setTotalReceivables(total);
    });

    fetchReceivables('initial');

    return () => unsubTotal();
  }, []);

  const fetchReceivables = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setLoading(true);
    setSelectedRows([]);
    const receivablesCol = collection(db, "transactions");
    
    // Adjusted query to avoid composite index requirement
    const baseQuery = query(receivablesCol, orderBy('date', 'desc'));

    let q;
    if (direction === 'next' && lastVisible) {
        q = query(baseQuery, startAfter(lastVisible), limit(TRANSACTIONS_PER_PAGE));
    } else if (direction === 'prev' && firstVisible) {
        q = query(baseQuery, endBefore(firstVisible), limitToLast(TRANSACTIONS_PER_PAGE));
    } else {
        q = query(baseQuery, limit(TRANSACTIONS_PER_PAGE));
    }
    
    const snapshot = await getDocs(q);

    const transactionList = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
      } as Transaction;
    }).filter(tx => tx.status === 'Belum Lunas'); // Filter on the client-side

    setReceivables(transactionList);
    
    if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setFirstVisible(snapshot.docs[0]);
        
        const nextDoc = snapshot.docs[snapshot.docs.length - 1];
        if (nextDoc) {
            const nextQuery = query(baseQuery, startAfter(nextDoc), limit(1));
            const nextSnapshot = await getDocs(nextQuery);
            setHasNextPage(!nextSnapshot.empty);
        } else {
             setHasNextPage(false);
        }
    } else {
        setLastVisible(null);
        setFirstVisible(null);
        setHasNextPage(false);
    }
    
    setLoading(false);
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
    fetchReceivables('next');
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      fetchReceivables('prev');
    }
  };
  
  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  }

  const handleSelectAll = () => {
    if (selectedRows.length === receivables.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(receivables.map(tx => tx.id));
    }
  }
  
  const totalSelectedAmount = receivables
    .filter(tx => selectedRows.includes(tx.id))
    .reduce((sum, tx) => sum + (tx.grandTotal || tx.total), 0);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Piutang Usaha</h1>
      </div>

      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                      <CardTitle>Daftar Piutang Belum Lunas</CardTitle>
                      <CardDescription>Total piutang dari semua pelanggan.</CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                      <p className="text-sm text-muted-foreground">Total Piutang</p>
                      <p className="text-xl sm:text-2xl font-bold text-destructive">Rp {totalReceivables.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>
              </div>
          </CardHeader>
          <CardContent>
             {selectedRows.length > 0 && (
                <div className="mb-4 p-3 bg-muted rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <p className="font-semibold">{selectedRows.length} transaksi terpilih</p>
                        <p className="text-sm text-muted-foreground">Total: Rp {totalSelectedAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <MultiSettleDialog 
                        transactionIds={selectedRows} 
                        onSettled={() => {
                            fetchReceivables('initial');
                            setSelectedRows([]);
                        }}
                    />
                </div>
            )}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">
                            <Checkbox 
                                checked={receivables.length > 0 && selectedRows.length === receivables.length}
                                onCheckedChange={handleSelectAll}
                            />
                        </TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>No. Invoice</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                         <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                    ) : receivables.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                Tidak ada piutang yang belum lunas.
                            </TableCell>
                        </TableRow>
                    ) : (
                        receivables.map(tx => (
                            <TableRow key={tx.id} className={cn(selectedRows.includes(tx.id) && 'bg-muted/50')}>
                                <TableCell>
                                    <Checkbox 
                                        checked={selectedRows.includes(tx.id)}
                                        onCheckedChange={() => handleSelectRow(tx.id)}
                                    />
                                </TableCell>
                                <TableCell>{format(tx.date, 'dd MMM yyyy')}</TableCell>
                                <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                                <TableCell>{tx.customerName}</TableCell>
                                <TableCell>
                                    <Badge variant="destructive">{tx.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">Rp {(tx.grandTotal || tx.total).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Halaman {currentPage}</span>
            <div className="flex gap-2">
                <Button variant="outline" onClick={handlePrevPage} disabled={currentPage === 1 || loading}>
                    <ArrowLeft className="mr-2 h-4 w-4"/> Sebelumnya
                </Button>
                <Button variant="outline" onClick={handleNextPage} disabled={!hasNextPage || loading}>
                    Berikutnya <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
