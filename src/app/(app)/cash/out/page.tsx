
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Loader2, History, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, NewJournal, JournalEntry, Journal } from '@/lib/types';
import { addJournalEntry, deleteJournalEntry } from '@/app/(app)/accounting/journal/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { cn } from '@/lib/utils';

export default function CashOutPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date | undefined>();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<Account[]>([]);
  const [destinationAccounts, setDestinationAccounts] = useState<Account[]>([]);
  
  const [history, setHistory] = useState<Journal[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);

  useEffect(() => {
    setDate(new Date());
    const unsub = onSnapshot(collection(db, 'coa'), (snapshot) => {
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)).sort((a,b) => a.code.localeCompare(b.code));
      setAllAccounts(accounts);
      setSourceAccounts(accounts.filter(a => a.type === 'Kas & Bank'));
      setDestinationAccounts(accounts.filter(a => a.type.startsWith('Beban') || a.type.startsWith('Aset')));
    });

    const qHistory = query(collection(db, 'journals'), orderBy('date', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
        const allJournals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: doc.data().date.toDate() } as Journal));
        setHistory(allJournals.filter(j => j.description.startsWith('Kas Keluar:')));
        setLoadingHistory(false);
    });

    return () => {
        unsub();
        unsubHistory();
    };
  }, []);

  const resetForm = () => {
    setDate(new Date());
    setDescription('');
    setAmount(0);
    setFromAccountId('');
    setToAccountId('');
  }

  const handleSave = () => {
    if (!fromAccountId || !toAccountId || amount <= 0 || !date || !description) {
        toast({ title: "Data tidak lengkap", description: "Mohon isi semua field yang diperlukan.", variant: "destructive" });
        return;
    }
    
    const fromAccount = allAccounts.find(a => a.id === fromAccountId);
    const toAccount = allAccounts.find(a => a.id === toAccountId);

    if (!fromAccount || !toAccount) {
        toast({ title: "Akun tidak valid", variant: "destructive" });
        return;
    }

    const journalEntries: JournalEntry[] = [
      { accountId: toAccountId, accountName: toAccount.name, debit: amount, credit: 0 },
      { accountId: fromAccountId, accountName: fromAccount.name, debit: 0, credit: amount },
    ];

    const newJournal: NewJournal = {
      date,
      description: `Kas Keluar: ${description}`,
      refNumber: '',
      entries: journalEntries,
      total: amount,
    };
    
    startTransition(async () => {
      const result = await addJournalEntry(newJournal);
      if (result.error) {
        toast({ title: "Gagal menyimpan transaksi", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Transaksi kas keluar berhasil disimpan!" });
        resetForm();
      }
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && setSelectedJournal(null)}>
        <div className="flex flex-col gap-6">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Kas Keluar</h1>
        <Card className="max-w-3xl mx-auto w-full">
            <CardHeader>
            <CardTitle className="font-headline">Catat Pengeluaran Kas</CardTitle>
            <CardDescription>
                Gunakan form ini untuk mencatat semua pengeluaran kas operasional (misalnya, bayar listrik, gaji) atau pembelian aset.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="cash-out-from">Keluar Dari Akun Kas/Bank (Kredit)</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId} disabled={isPending}>
                <SelectTrigger id="cash-out-from">
                    <SelectValue placeholder="Pilih akun kas/bank sumber dana" />
                </SelectTrigger>
                <SelectContent>
                    {sourceAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="cash-out-to">Untuk Akun Tujuan (Debit)</Label>
                <Select value={toAccountId} onValueChange={setToAccountId} disabled={isPending}>
                <SelectTrigger id="cash-out-to">
                    <SelectValue placeholder="Pilih akun beban atau aset" />
                </SelectTrigger>
                <SelectContent>
                    {destinationAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="amount">Jumlah</Label>
                <Input id="amount" type="number" placeholder="Masukkan jumlah pengeluaran" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} onFocus={(e) => e.target.select()} disabled={isPending} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="transaction-date">Tanggal Transaksi</Label>
                <DatePicker date={date} setDate={setDate} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea id="description" placeholder="Contoh: Pembayaran gaji karyawan bulan Juli" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPending} />
            </div>
            </CardContent>
            <CardFooter className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending || amount <= 0 || !toAccountId || !fromAccountId || !description}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Transaksi
            </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><History /> Riwayat Pengeluaran</CardTitle>
                <CardDescription>Daftar pengeluaran kas yang telah dicatat.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead>Akun Tujuan</TableHead>
                            <TableHead className="text-right">Jumlah</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingHistory ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="animate-spin"/></TableCell></TableRow>
                        ) : history.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Belum ada riwayat pengeluaran.</TableCell></TableRow>
                        ) : (
                            history.map(item => (
                                <HistoryRow key={item.id} item={item} onSelectJournal={setSelectedJournal} />
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {selectedJournal && (
            <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Detail Jurnal: {selectedJournal.refNumber || selectedJournal.id}</DialogTitle>
                <DialogDescription>{selectedJournal.description}</DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-[60vh] overflow-y-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Akun</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Kredit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {selectedJournal.entries.map((entry, idx) => (
                    <TableRow key={idx}>
                        <TableCell>{entry.accountName}</TableCell>
                        <TableCell className="text-right font-mono">{entry.debit > 0 ? entry.debit.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '-'}</TableCell>
                        <TableCell className="text-right font-mono">{entry.credit > 0 ? entry.credit.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '-'}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
            </DialogContent>
        )}
        </div>
    </Dialog>
  );
}


function HistoryRow({ item, onSelectJournal }: { item: Journal, onSelectJournal: (journal: Journal | null) => void }) {
    const [isDeleting, startDeleteTransition] = useTransition();
    const { toast } = useToast();

    const debitEntry = item.entries.find(e => e.debit > 0);

    const handleDelete = () => {
        startDeleteTransition(async () => {
            const result = await deleteJournalEntry(item.id);
            if (result.error) {
                toast({ title: 'Gagal menghapus', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Berhasil', description: 'Transaksi kas keluar telah dihapus.' });
            }
        });
    };

    return (
        <TableRow>
            <TableCell>
                <DialogTrigger asChild>
                    <Button variant="link" className="p-0 h-auto" onClick={() => onSelectJournal(item)}>
                        {format(item.date, "dd MMM yyyy", { locale: id })}
                    </Button>
                </DialogTrigger>
            </TableCell>
            <TableCell>{item.description.replace('Kas Keluar: ', '')}</TableCell>
            <TableCell>{debitEntry?.accountName}</TableCell>
            <TableCell className="text-right font-mono">Rp {item.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
            <TableCell className="text-right">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isDeleting}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tindakan ini akan menghapus transaksi kas keluar ini secara permanen. Jurnal yang terkait juga akan dihapus.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className={cn(buttonVariants({ variant: "destructive" }))}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Ya, Hapus
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </TableCell>
        </TableRow>
    );
}
