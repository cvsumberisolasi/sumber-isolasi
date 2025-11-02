
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
import { Loader2, Upload, AlertCircle, Plus, FilePlus, Minus, Banknote, CheckCircle, CirclePlus } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';


type BankStatementItem = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    isMatched: boolean;
};

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [bankStatementItems, setBankStatementItems] = useState<BankStatementItem[]>([]);
  
  const [bookBalance, setBookBalance] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'coa'), orderBy('name'));
    const unsubAccounts = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)).sort((a,b) => a.code.localeCompare(b.code)));
    });

    return () => unsubAccounts();
  }, []);

  useEffect(() => {
    if (!selectedAccountId || !dateRange?.to) return;

    setLoading(true);
    const toDayEnd = new Date(dateRange.to);
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


  useEffect(() => {
    if (bankStatementItems.length === 0 || journals.length === 0) return;

    setBankStatementItems(prevItems => prevItems.map(item => {
        const isMatched = journals.some(j => 
            Math.abs(j.total - Math.abs(item.amount)) < 0.01 && // Check if amount is very close
            j.entries.some(e => e.accountId === selectedAccountId)
        );
        return { ...item, isMatched };
    }));
  }, [bankStatementItems.length, journals, selectedAccountId]);


  const bankAccounts = accounts.filter(a => a.type === 'Kas & Bank');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (json.length < 2) throw new Error("File tidak memiliki data yang cukup.");

          // Find header row dynamically
          let headerRowIndex = -1;
          for (let i = 0; i < json.length; i++) {
              const row = json[i].map((h:any) => String(h || '').toLowerCase().trim());
              if (row.includes('tanggal') && (row.includes('debet') || row.includes('kredit'))) {
                  headerRowIndex = i;
                  break;
              }
          }
          if (headerRowIndex === -1) throw new Error("Header kolom 'Tanggal', 'Debet', atau 'Kredit' tidak ditemukan.");

          const header = json[headerRowIndex].map((h:any) => String(h).toLowerCase().trim());
          const dateIndex = header.indexOf('tanggal');
          const descriptionIndex = header.indexOf('keterangan');
          const debitIndex = header.indexOf('debet');
          const creditIndex = header.indexOf('kredit');

          const statementItems: BankStatementItem[] = json.slice(headerRowIndex + 1).map((row, i) => {
            const amount = (row[debitIndex] || 0) - (row[creditIndex] || 0);
            return {
              id: `stmt-${i}`,
              date: row[dateIndex] instanceof Date ? row[dateIndex] : new Date(),
              description: row[descriptionIndex] || 'N/A',
              amount: -amount, // Invert so debits are negative, credits are positive from bank's perspective
              isMatched: false,
            };
          }).filter(item => item.amount !== 0);

          setBankStatementItems(statementItems);
          toast({ title: 'File Berhasil Dibaca', description: `${statementItems.length} transaksi ditemukan di laporan koran.`});
        } catch (err: any) {
          toast({ title: 'Gagal Membaca File', description: err.message, variant: 'destructive'});
        }
      };
      reader.readAsBinaryString(file);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Rekonsiliasi Bank</h1>
        <div className="flex items-center gap-2">
            <DateRangePicker onSelect={setDateRange} />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Proses Rekonsiliasi</CardTitle>
          <CardDescription>Unggah laporan koran Anda, lalu cocokkan transaksi dan buat jurnal penyesuaian jika perlu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Akun Bank untuk Rekonsiliasi</Label>
                    <Select onValueChange={setSelectedAccountId} disabled={loading}>
                        <SelectTrigger><SelectValue placeholder="Pilih Akun Bank..." /></SelectTrigger>
                        <SelectContent>
                            {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Unggah Laporan Koran (.xlsx, .csv)</Label>
                    <div className="flex gap-2">
                      <Input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="hidden" />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full justify-start">
                          <Upload className="mr-2 h-4 w-4"/> Pilih File...
                      </Button>
                    </div>
                </div>
            </div>
            
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Perhatian</AlertTitle>
                <AlertDescription>
                   Sistem akan mencoba mencocokkan transaksi berdasarkan jumlah. Transaksi yang belum tercatat (misal: biaya admin, bunga) dapat dibuatkan jurnal penyesuaiannya.
                </AlertDescription>
            </Alert>
            
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Deskripsi (dari Bank)</TableHead>
                            <TableHead className="text-right">Jumlah</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bankStatementItems.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Silakan unggah laporan koran Anda.</TableCell></TableRow>
                        ) : (
                            bankStatementItems.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{format(item.date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className={cn("text-right font-mono", item.amount > 0 ? 'text-green-600' : 'text-destructive')}>
                                        {item.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.isMatched ? (
                                            <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3"/> Cocok</Badge>
                                        ) : (
                                            <Badge variant="outline">Belum Tercatat</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!item.isMatched && selectedAccountId && (
                                            <AdjustmentJournalDialog
                                              bankItem={item}
                                              reconciledAccountId={selectedAccountId}
                                              allAccounts={accounts}
                                              onJournalCreated={() => {
                                                  // A simple way to refresh is to re-trigger the effect
                                                  setSelectedAccountId(prev => (prev ? `${prev} ` : ' ').trim());
                                              }}
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}


interface AdjustmentJournalDialogProps {
  bankItem: { description: string, date: Date, amount: number };
  reconciledAccountId: string | null;
  allAccounts: Account[];
  onJournalCreated: () => void;
}

function AdjustmentJournalDialog({ bankItem, reconciledAccountId, allAccounts, onJournalCreated }: AdjustmentJournalDialogProps) {
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
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <CirclePlus className="mr-2 h-4 w-4"/> Buat Jurnal
              </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Buat Jurnal Penyesuaian</DialogTitle>
                    <DialogDescription>Buat entri jurnal untuk transaksi bank yang belum tercatat di pembukuan.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex justify-between items-center bg-muted p-2 rounded-md">
                        <span className="text-sm">{bankItem.description}</span>
                        <span className="text-sm font-mono font-bold">Rp {bankItem.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
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
