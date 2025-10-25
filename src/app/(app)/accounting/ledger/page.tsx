
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { collection, onSnapshot, query, orderBy, where, Timestamp, getDocs, limit, startAfter, DocumentData, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal, JournalEntry } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfDay } from 'date-fns';

type LedgerEntry = {
  date: Date;
  ref: string;
  desc: string;
  debit: number;
  credit: number;
  balance: number;
};

const isDebitNormal = (type: string = '') => type.startsWith('Aset') || type.startsWith('Beban');


export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);


  useEffect(() => {
    const unsubAccounts = onSnapshot(collection(db, 'coa'), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)).sort((a,b) => a.code.localeCompare(b.code)));
      setLoading(false);
    });

    return () => unsubAccounts();
  }, []);
  
  const fetchLedgerEntries = useCallback(async () => {
    if (!selectedAccountId) return;
    
    setLoading(true);

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) {
        setLoading(false);
        return;
    }
    const debitNormal = isDebitNormal(selectedAccount.type);

    // --- Phase 1: Calculate beginning balance ---
    let beginningBalance = 0;
    const periodStartDate = dateRange?.from ? startOfDay(dateRange.from) : null;
    
    if (periodStartDate) {
        const journalsBeforeQuery = query(
            collection(db, 'journals'),
            where('date', '<', Timestamp.fromDate(periodStartDate))
        );
        const journalsBeforeSnap = await getDocs(journalsBeforeQuery);
        journalsBeforeSnap.docs.forEach(journalDoc => {
            const journal = journalDoc.data() as Journal;
            journal.entries.forEach(entry => {
                if (entry.accountId === selectedAccountId) {
                    const balanceEffect = debitNormal ? (entry.debit - entry.credit) : (entry.credit - entry.debit);
                    beginningBalance += balanceEffect;
                }
            });
        });
    }
    
    let runningBalance = beginningBalance;
    
    // --- Phase 2: Fetch entries for the current page ---
    let journalsInPeriodQuery = query(
        collection(db, 'journals'),
        orderBy("date", "asc")
    );

    if (dateRange?.from) {
        journalsInPeriodQuery = query(journalsInPeriodQuery, where("date", ">=", Timestamp.fromDate(dateRange.from)));
    }
    if (dateRange?.to) {
        const toDayEnd = new Date(dateRange.to);
        toDayEnd.setHours(23, 59, 59, 999);
        journalsInPeriodQuery = query(journalsInPeriodQuery, where("date", "<=", Timestamp.fromDate(toDayEnd)));
    }
    
    const journalsSnapshot = await getDocs(journalsInPeriodQuery);
    
    const relevantEntries: LedgerEntry[] = [];
    journalsSnapshot.docs.forEach(journalDoc => {
        const journal = { ...journalDoc.data(), id: journalDoc.id } as Journal;
        journal.entries.forEach(entry => {
            if (entry.accountId === selectedAccountId) {
                 const balanceEffect = debitNormal ? (entry.debit - entry.credit) : (entry.credit - entry.debit);
                 runningBalance += balanceEffect;
                 relevantEntries.push({
                    date: journal.date.toDate(),
                    ref: journal.id,
                    desc: journal.description,
                    debit: entry.debit,
                    credit: entry.credit,
                    balance: runningBalance
                });
            }
        });
    });

    const beginningBalanceRow: LedgerEntry = {
        date: dateRange?.from || new Date(),
        ref: '',
        desc: 'Saldo Awal',
        debit: 0,
        credit: 0,
        balance: beginningBalance
    };

    setLedgerEntries([beginningBalanceRow, ...relevantEntries]);
    setLoading(false);

  }, [selectedAccountId, dateRange, accounts]);


  useEffect(() => {
    if (selectedAccountId) {
        fetchLedgerEntries();
    } else {
        setLedgerEntries([]);
    }
  }, [selectedAccountId, dateRange, fetchLedgerEntries]);

  
  const handleRefClick = async (journalId: string) => {
    try {
        const journalRef = doc(db, 'journals', journalId);
        const journalSnap = await getDoc(journalRef);
        if (journalSnap.exists()) {
            const journalData = journalSnap.data();
            setSelectedJournal({
                id: journalSnap.id,
                ...journalData,
                date: journalData.date.toDate()
            } as Journal);
            setIsDetailOpen(true);
        }
    } catch (e) {
        console.error("Failed to fetch journal details:", e);
    }
  }


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Buku Besar (General Ledger)
        </h1>
         <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <DateRangePicker onSelect={setDateRange} className="w-full" />
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Ekspor
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Detail Transaksi Akun</CardTitle>
          <CardDescription>
            Pilih akun untuk melihat seluruh riwayat transaksi yang memengaruhinya.
          </CardDescription>
          <div className="pt-4">
             <Select onValueChange={setSelectedAccountId}>
              <SelectTrigger id="account" className="max-w-md">
                <SelectValue placeholder="Pilih Akun..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Ref</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                           <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                    </TableRow>
                ) : ledgerEntries.length > 0 ? (
                  ledgerEntries.map((tx, index) => (
                    <TableRow key={index} className={tx.desc === 'Saldo Awal' ? 'bg-muted/50 font-bold' : ''}>
                      <TableCell>{format(tx.date, 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.ref ? (
                          <Button variant="link" className="p-0 h-auto" onClick={() => handleRefClick(tx.ref)}>
                            ...{tx.ref.slice(-8)}
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{tx.desc}</TableCell>
                      <TableCell className="text-right font-mono">
                        {tx.debit > 0 ? tx.debit.toLocaleString('id-ID') : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tx.credit > 0 ? tx.credit.toLocaleString('id-ID') : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {tx.balance.toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                           {selectedAccountId ? "Tidak ada transaksi untuk akun ini pada periode yang dipilih." : "Silakan pilih akun untuk melihat riwayatnya."}
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Detail Jurnal: {selectedJournal?.id}</DialogTitle>
                  <DialogDescription>
                      {selectedJournal?.description}
                  </DialogDescription>
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
                            {selectedJournal?.entries.map((entry, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>{entry.accountName}</TableCell>
                                    <TableCell className="text-right font-mono">{entry.debit > 0 ? entry.debit.toLocaleString('id-ID') : '-'}</TableCell>
                                    <TableCell className="text-right font-mono">{entry.credit > 0 ? entry.credit.toLocaleString('id-ID') : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
          </DialogContent>
      </Dialog>

    </div>
  );
}

// Add this to date-range-picker component to accept onSelect props
declare module '@/components/ui/date-range-picker' {
    interface DateRangePickerProps {
        onSelect?: (date?: DateRange) => void;
    }
}
