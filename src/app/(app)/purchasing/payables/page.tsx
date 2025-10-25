
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SupplierInvoice, Account, NewPurchasePayment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { paySupplierInvoice } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';

export default function AccountsPayablePage() {
  const [payables, setPayables] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'supplierInvoices'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allInvoices = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      } as SupplierInvoice));
      const unpaidInvoices = allInvoices.filter(inv => inv.status === 'Unpaid');
      setPayables(unpaidInvoices);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const totalPayables = payables.reduce((sum, tx) => sum + tx.total, 0);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Utang Usaha (Accounts Payable)</h1>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Daftar Faktur Belum Dibayar</CardTitle>
              <CardDescription>Total utang usaha kepada semua pemasok.</CardDescription>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-muted-foreground">Total Utang</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">Rp {totalPayables.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tgl Faktur</TableHead>
                <TableHead>No. Faktur</TableHead>
                <TableHead>Pemasok</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payables.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Tidak ada utang yang perlu dibayar.</TableCell></TableRow>
              ) : (
                payables.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>{format(inv.date, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.supplierName}</TableCell>
                    <TableCell className="text-right font-medium">Rp {inv.total.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right"><PaymentDialog invoice={inv} /></TableCell>
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

function PaymentDialog({ invoice }: { invoice: SupplierInvoice }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [amount, setAmount] = useState(invoice.total);
    const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'coa'), where('type', '==', 'Kas & Bank'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCashBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });
        return () => unsubscribe();
    }, []);

    const handlePayment = () => {
        if (!paymentAccountId || !paymentDate || amount <= 0) {
            toast({ title: 'Data pembayaran tidak lengkap', variant: 'destructive' });
            return;
        }
        if (amount > invoice.total) {
            toast({ title: 'Jumlah bayar melebihi total faktur', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const paymentData: NewPurchasePayment = {
                date: paymentDate,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount,
                paymentAccountId,
            }
            const result = await paySupplierInvoice(paymentData);
            if (result.error) {
                toast({ title: 'Gagal mencatat pembayaran', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Pembayaran berhasil dicatat!' });
                setOpen(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm"><HandCoins className="mr-2 h-4 w-4" /> Catat Pembayaran</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pembayaran Faktur #{invoice.invoiceNumber}</DialogTitle>
                    <DialogDescription>
                        Catat pembayaran untuk faktur dari {invoice.supplierName} sebesar Rp {invoice.total.toLocaleString('id-ID')}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Akun Pembayaran (Kas/Bank)</Label>
                        <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                            <SelectTrigger><SelectValue placeholder="Pilih akun kas/bank..." /></SelectTrigger>
                            <SelectContent>
                                {cashBankAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label>Tanggal Pembayaran</Label>
                        <DatePicker date={paymentDate} setDate={setPaymentDate} />
                    </div>
                     <div className="space-y-2">
                        <Label>Jumlah Bayar</Label>
                        <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} onFocus={(e) => e.target.select()} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
                    <Button onClick={handlePayment} disabled={isPending || !paymentAccountId || amount <= 0}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Konfirmasi Bayar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
