
'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertCircle, Plus, FilePlus, Minus, Banknote, CheckCircle } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { collection, onSnapshot, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { createAdjustmentJournal } from './actions';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


type AdjustmentItem = {
    id: number;
    description: string;
    amount: number;
}

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  const [bookBalance, setBookBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  
  const [additionsToBank, setAdditionsToBank] = useState<AdjustmentItem[]>([]);
  const [deductionsFromBank, setDeductionsFromBank] = useState<AdjustmentItem[]>([]);
  const [additionsToBook, setAdditionsToBook] = useState<AdjustmentItem[]>([]);
  const [deductionsFromBook, setDeductionsFromBook] = useState<AdjustmentItem[]>([]);
  
  const [nextId, setNextId] = useState(1);

  useEffect(() => {
    const q = query(collection(db, 'coa'), orderBy('name'));
    const unsubAccounts = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)).sort((a,b) => a.code.localeCompare(b.code)));
    });

    return () => unsubAccounts();
  }, []);

  useEffect(() => {
    if (!selectedAccountId || !dateRange?.from) return;

    setLoading(true);
    const toDayEnd = new Date(dateRange.to || dateRange.from);
    toDayEnd.setHours(23, 59, 59, 999);
    const to = Timestamp.fromDate(toDayEnd);

    const q = query(
      collection(db, "journals"), 
      where("date", "<=", to)
    );

    const unsubJournals = onSnapshot(q, (snapshot) => {
      const allJournals = snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(), date: doc.data().date.toDate()
      } as Journal));

      let runningBalance = 0;
      allJournals.sort((a, b) => a.date.getTime() - b.date.getTime())
        .forEach(journal => {
            journal.entries.forEach(entry => {
                if (entry.accountId === selectedAccountId) {
                    runningBalance += entry.debit - entry.credit;
                }
            })
        });
      
      setBookBalance(runningBalance);
      setLoading(false);
    });

    return () => unsubJournals();
  }, [selectedAccountId, dateRange]);

  const handleAdjustmentChange = (
    setter: React.Dispatch<React.SetStateAction<AdjustmentItem[]>>, 
    id: number, 
    field: 'description' | 'amount', 
    value: string | number
  ) => {
    setter(prev => prev.map(item => item.id === id ? {...item, [field]: value} : item));
  }

  const addAdjustment = (setter: React.Dispatch<React.SetStateAction<AdjustmentItem[]>>) => {
    setter(prev => [...prev, {id: nextId, description: '', amount: 0}]);
    setNextId(prev => prev + 1);
  }
  
  const removeAdjustment = (setter: React.Dispatch<React.SetStateAction<AdjustmentItem[]>>, id: number) => {
    setter(prev => prev.filter(item => item.id !== id));
  }

  const bankTotalAdditions = useMemo(() => additionsToBank.reduce((sum, item) => sum + Number(item.amount), 0), [additionsToBank]);
  const bankTotalDeductions = useMemo(() => deductionsFromBank.reduce((sum, item) => sum + Number(item.amount), 0), [deductionsFromBank]);
  const bookTotalAdditions = useMemo(() => additionsToBook.reduce((sum, item) => sum + Number(item.amount), 0), [additionsToBook]);
  const bookTotalDeductions = useMemo(() => deductionsFromBook.reduce((sum, item) => sum + Number(item.amount), 0), [deductionsFromBook]);
  
  const adjustedBankBalance = bankBalance + bankTotalAdditions - bankTotalDeductions;
  const adjustedBookBalance = bookBalance + bookTotalAdditions - bookTotalDeductions;
  
  const difference = adjustedBookBalance - adjustedBankBalance;
  
  const bankAccounts = accounts.filter(a => a.type === 'Kas & Bank');

  const renderAdjustmentSection = (
    title: string,
    items: AdjustmentItem[],
    setter: React.Dispatch<React.SetStateAction<AdjustmentItem[]>>
  ) => (
    <div className="space-y-2">
        <h4 className="font-semibold text-muted-foreground">{title}</h4>
        {items.map(item => (
            <div key={item.id} className="flex items-center gap-2">
                <Input 
                    placeholder="Deskripsi..." 
                    value={item.description} 
                    onChange={e => handleAdjustmentChange(setter, item.id, 'description', e.target.value)}
                    className="h-8"
                />
                <Input 
                    type="number" 
                    placeholder="Jumlah" 
                    value={item.amount || ''}
                    onChange={e => handleAdjustmentChange(setter, item.id, 'amount', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="h-8 w-32 text-right"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAdjustment(setter, item.id)}>
                    <Minus className="h-4 w-4"/>
                </Button>
            </div>
        ))}
         <Button variant="outline" size="sm" className="w-full" onClick={() => addAdjustment(setter)}>
            <Plus className="mr-2 h-4 w-4"/> Tambah Item
        </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Rekonsiliasi Bank
        </h1>
         <div className="flex items-center gap-2">
            <DateRangePicker onSelect={setDateRange} />
        </div>
      </div>
       <Card>
        <CardHeader>
          <CardTitle className="font-headline">Proses Rekonsiliasi</CardTitle>
          <CardDescription>
            Sesuaikan saldo buku dan bank hingga keduanya seimbang.
          </CardDescription>
          <div className="pt-4 max-w-sm">
             <Select onValueChange={setSelectedAccountId} disabled={loading}>
              <SelectTrigger id="account">
                <SelectValue placeholder="Pilih Akun Bank..." />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
           <div className="grid md:grid-cols-2 gap-8">
                {/* Kolom Bank */}
                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-headline text-lg">Saldo Menurut Bank</h3>
                     <div className="space-y-2">
                        <Label>Saldo Akhir Laporan Koran</Label>
                        <Input type="number" placeholder="Masukkan saldo dari laporan koran" value={bankBalance || ''} onChange={e => setBankBalance(Number(e.target.value))} onFocus={(e) => e.target.select()} />
                    </div>
                    {renderAdjustmentSection("Ditambah: Setoran dalam Perjalanan", additionsToBank, setAdditionsToBank)}
                    {renderAdjustmentSection("Dikurangi: Cek Beredar", deductionsFromBank, setDeductionsFromBank)}
                    <div className="flex justify-between items-center font-bold text-lg pt-4 border-t">
                        <span>Saldo Bank Disesuaikan</span>
                        <span>Rp {adjustedBankBalance.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                 {/* Kolom Buku */}
                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-headline text-lg">Saldo Menurut Pembukuan</h3>
                     <div className="space-y-2">
                        <Label>Saldo Akhir Buku Besar</Label>
                        <Input type="number" value={bookBalance} disabled className="font-semibold"/>
                    </div>
                    {renderAdjustmentSection("Ditambah: Pendapatan (misal: bunga)", additionsToBook, setAdditionsToBook)}
                    {renderAdjustmentSection("Dikurangi: Beban (misal: admin bank)", deductionsFromBook, setDeductionsFromBook)}
                     <div className="flex justify-between items-center font-bold text-lg pt-4 border-t">
                        <span>Saldo Buku Disesuaikan</span>
                        <span>Rp {adjustedBookBalance.toLocaleString('id-ID')}</span>
                    </div>
                </div>
           </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-4">
            <h3 className="font-semibold">Ringkasan Rekonsiliasi</h3>
            {difference !== 0 ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Belum Seimbang</AlertTitle>
                    <AlertDescription>
                        Masih ada selisih sebesar Rp {difference.toLocaleString('id-ID')}. Periksa kembali item penyesuaian Anda.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert variant="default" className="border-green-500 text-green-700 [&>svg]:text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Seimbang!</AlertTitle>
                    <AlertDescription>
                        Saldo bank dan buku sudah cocok. Anda bisa menyelesaikan rekonsiliasi.
                    </AlertDescription>
                </Alert>
            )}
            <Button disabled={difference !== 0 || loading}>Selesaikan Rekonsiliasi</Button>
        </CardFooter>
       </Card>
    </div>
  );
}


interface AdjustmentJournalDialogProps {
  triggerButton: React.ReactNode;
  bankItem: { description: string, date: Date, amount: number };
  reconciledAccountId: string | null;
  allAccounts: Account[];
  onJournalCreated: () => void;
}

function AdjustmentJournalDialog({ triggerButton, bankItem, reconciledAccountId, allAccounts, onJournalCreated }: AdjustmentJournalDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [contraAccountId, setContraAccountId] = useState('');

    const handleSubmit = () => {
        if (!reconciledAccountId || !contraAccountId) {
            toast({ title: 'Data tidak lengkap', variant: 'destructive'});
            return;
        }
        startTransition(async () => {
            const result = await createAdjustmentJournal(
                bankItem.date,
                bankItem.description,
                bankItem.amount,
                reconciledAccountId,
                contraAccountId
            );
            if (result.error) {
                toast({ title: 'Gagal Membuat Jurnal', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Jurnal Penyesuaian Dibuat'});
                onJournalCreated();
                setOpen(false);
            }
        });
    }

    const nonCashAccounts = allAccounts.filter(a => a.type !== 'Kas & Bank');

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{triggerButton}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Buat Jurnal Penyesuaian</DialogTitle>
                    <DialogDescription>Buat entri jurnal untuk transaksi bank yang belum tercatat di pembukuan.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex justify-between items-center bg-muted p-2 rounded-md">
                        <span className="text-sm">{bankItem.description}</span>
                        <span className="text-sm font-mono font-bold">Rp {bankItem.amount.toLocaleString('id-ID')}</span>
                    </div>
                     <div className="space-y-2">
                        <Label>Akun Lawan (Kontra)</Label>
                        <Select value={contraAccountId} onValueChange={setContraAccountId}>
                            <SelectTrigger><SelectValue placeholder="Pilih akun..."/></SelectTrigger>
                            <SelectContent>
                                {nonCashAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Pilih akun yang sesuai, misal: Beban Admin Bank, Pendapatan Bunga.</p>
                     </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={!contraAccountId || isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Buat Jurnal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

declare module '@/components/ui/date-range-picker' {
    interface DateRangePickerProps {
        onSelect?: (date?: DateRange) => void;
    }
}

declare module '@/components/ui/alert' {
    interface AlertProps {
        children?: React.ReactNode;
    }
}
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // extends React's HTMLAttributes
    'data-value'?: string;
    'data-state'?: 'checked' | 'unchecked' | 'indeterminate' | 'open' | 'closed';
  }
}
