
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ReportRow = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

const isPermanentAccount = (type: string) => !['Pendapatan', 'Pendapatan Lainnya', 'Beban Pokok Penjualan', 'Beban Operasional', 'Beban Lainnya'].includes(type);

export default function PostClosingTrialBalancePage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAccounts = onSnapshot(query(collection(db, 'coa'), orderBy('code')), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });
    return () => unsubAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length === 0 || !reportDate) return;

    setLoading(true);
    const endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);
    const to = Timestamp.fromDate(endDate);
    
    const q = query(collection(db, 'journals'), where("date", "<=", to), orderBy('date', 'asc'));

    const unsubJournals = onSnapshot(q, (snapshot) => {
        setJournals(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: doc.data().date.toDate() } as Journal)));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching journals:", error);
        setLoading(false);
    });

    return () => unsubJournals();
  }, [reportDate, accounts]);

  const reportData: ReportRow[] = useMemo(() => {
    const balances: { [key: string]: number } = {};
    const permanentAccounts = accounts.filter(acc => isPermanentAccount(acc.type));
    
    permanentAccounts.forEach(acc => { balances[acc.id] = 0; });

    journals.forEach(journal => {
      journal.entries.forEach(entry => {
        if (balances[entry.accountId] !== undefined) {
          const account = permanentAccounts.find(a => a.id === entry.accountId);
          if (!account) return;

          const isDebitNormal = account.type.startsWith('Aset') || account.type.startsWith('Beban');
          const balanceEffect = isDebitNormal ? entry.debit - entry.credit : entry.credit - entry.debit;
          
          balances[entry.accountId] += balanceEffect;
        }
      });
    });

    return permanentAccounts.map(account => {
      const balance = balances[account.id] || 0;
      const isDebitNormal = account.type.startsWith('Aset') || account.type.startsWith('Kas');
      
      let debit = 0;
      let credit = 0;

      if (isDebitNormal) {
        debit = balance > 0 ? balance : 0;
        credit = balance < 0 ? -balance : 0;
      } else { // Credit normal
        credit = balance > 0 ? balance : 0;
        debit = balance < 0 ? -balance : 0;
      }

      return {
        accountCode: account.code,
        accountName: account.name,
        debit,
        credit,
      };
    }).filter(row => row.debit !== 0 || row.credit !== 0);
  }, [journals, accounts]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, row) => {
      acc.debit += row.debit;
      acc.credit += row.credit;
      return acc;
    }, { debit: 0, credit: 0 });
  }, [reportData]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">Neraca Saldo Setelah Penutupan</h1>
        <DatePicker date={reportDate} setDate={setReportDate} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Post-Closing Trial Balance</CardTitle>
          <CardDescription>
            Laporan per tanggal: {reportDate ? format(reportDate, 'd MMMM yyyy', { locale: id }) : '...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Kode Akun</TableHead>
                    <TableHead>Nama Akun</TableHead>
                    <TableHead className="text-right">Debit (Rp)</TableHead>
                    <TableHead className="text-right">Kredit (Rp)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.map((row, index) => (
                    <TableRow key={index}>
                        <TableCell className="font-mono">{row.accountCode}</TableCell>
                        <TableCell>{row.accountName}</TableCell>
                        <TableCell className="text-right font-mono">{row.debit > 0 ? row.debit.toLocaleString('id-ID') : '-'}</TableCell>
                        <TableCell className="text-right font-mono">{row.credit > 0 ? row.credit.toLocaleString('id-ID') : '-'}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold text-base">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className={cn("text-right font-mono", totals.debit !== totals.credit && "text-destructive")}>
                        {totals.debit.toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", totals.debit !== totals.credit && "text-destructive")}>
                        {totals.credit.toLocaleString('id-ID')}
                    </TableCell>
                    </TableRow>
                </TableFooter>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
