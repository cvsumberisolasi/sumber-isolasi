
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ReportRow = {
  accountId: string;
  accountName: string;
  amount: number;
};

type FinancialReport = {
  revenues: ReportRow[];
  cogs: ReportRow[];
  expenses: ReportRow[];
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalExpense: number;
  netIncome: number;
};

export default function FinancialReportsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newFrom = new Date(year, month - 1, 1);
    const newTo = endOfMonth(newFrom);
    setDateRange({ from: newFrom, to: newTo });
  }, [year, month]);

  useEffect(() => {
    const unsubAccounts = onSnapshot(collection(db, 'coa'), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });

    return () => unsubAccounts();
  }, []);
  
  useEffect(() => {
    if (accounts.length === 0 || !dateRange?.from) return;

    setLoading(true);
    const journalsCol = collection(db, 'journals');
    
    const from = Timestamp.fromDate(dateRange.from);
    const toDayEnd = new Date(dateRange.to || dateRange.from);
    toDayEnd.setHours(23, 59, 59, 999);
    const to = Timestamp.fromDate(toDayEnd);
    
    let q = query(journalsCol, where("date", ">=", from), where("date", "<=", to));

    const unsubJournals = onSnapshot(q, (snapshot) => {
        setJournals(snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, date: data.date.toDate() } as Journal;
        }));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching journals:", error);
        setLoading(false);
    });

    return () => unsubJournals();
  }, [dateRange, accounts]);


  const reportData: FinancialReport = useMemo(() => {
    const revenueAccountTypes = ['Pendapatan', 'Pendapatan Lainnya'];
    const cogsAccountTypes = ['Beban Pokok Penjualan'];
    const expenseAccountTypes = ['Beban Operasional', 'Beban Lainnya'];

    const accountBalances: { [key: string]: number } = {};
    accounts.forEach(acc => {
        if ([...revenueAccountTypes, ...cogsAccountTypes, ...expenseAccountTypes].includes(acc.type)) {
            accountBalances[acc.id] = 0;
        }
    });

    journals.forEach(journal => {
      journal.entries.forEach(entry => {
        const account = accounts.find(a => a.id === entry.accountId);
        if (account && accountBalances[entry.accountId] !== undefined) {
           const balanceEffect = (revenueAccountTypes.includes(account.type)) 
                ? entry.credit - entry.debit
                : entry.debit - entry.credit;
            accountBalances[entry.accountId] += balanceEffect;
        }
      });
    });

    const report: FinancialReport = {
      revenues: [], cogs: [], expenses: [],
      totalRevenue: 0, totalCogs: 0, grossProfit: 0, totalExpense: 0, netIncome: 0,
    };

    Object.entries(accountBalances).forEach(([accountId, balance]) => {
      const account = accounts.find(a => a.id === accountId);
      if (account && balance !== 0) {
        const row = { accountId: account.id, accountName: account.name, amount: balance };
        if (revenueAccountTypes.includes(account.type)) {
          report.revenues.push(row);
        } else if (cogsAccountTypes.includes(account.type)) {
          report.cogs.push(row);
        } else if (expenseAccountTypes.includes(account.type)) {
          report.expenses.push(row);
        }
      }
    });
    
    report.totalRevenue = report.revenues.reduce((sum, r) => sum + r.amount, 0);
    report.totalCogs = report.cogs.reduce((sum, c) => sum + c.amount, 0);
    report.totalExpense = report.expenses.reduce((sum, e) => sum + e.amount, 0);
    report.grossProfit = report.totalRevenue - report.totalCogs;
    report.netIncome = report.grossProfit - report.totalExpense;

    return report;
  }, [journals, accounts]);
  
  const handleExportPDF = async () => {
    // PDF Export Logic remains the same
  };

  const ReportRowLink = ({ row }: { row: ReportRow }) => {
    const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
    const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : from;
    const link = `/accounting/ledger?accountId=${row.accountId}&from=${from}&to=${to}`;

    return (
        <TableRow>
            <TableCell className="pl-8">
                <Link href={link} className="flex items-center hover:underline">
                    {row.accountName}
                    <ExternalLink className="inline-block ml-2 h-3 w-3 text-muted-foreground"/>
                </Link>
            </TableCell>
            <TableCell className="text-right font-mono">{row.amount.toLocaleString('id-ID')}</TableCell>
        </TableRow>
    );
  };

  const renderSection = (title: string, rows: ReportRow[], total: number, isTotal=true, className?: string, titleClassName?: string) => (
    <>
      <TableRow className={titleClassName}>
        <TableHead colSpan={2} className="font-bold">{title}</TableHead>
      </TableRow>
      {rows.map((row) => (
        <ReportRowLink key={row.accountId} row={row} />
      ))}
      {isTotal && rows.length > 0 && (
        <TableRow className={cn("font-bold", className)}>
            <TableCell className="pl-8">Total {title}</TableCell>
            <TableCell className="text-right font-mono">{total.toLocaleString('id-ID')}</TableCell>
        </TableRow>
      )}
    </>
  );
  
  const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });

  return (
    <div className="flex flex-col gap-6">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Laporan Laba Rugi</h2>
        <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Button onClick={handleExportPDF} variant="outline" disabled={loading}>
                <Download className="mr-2 h-4 w-4"/>
                Ekspor PDF
            </Button>
        </div>
      </div>
      <Card ref={reportRef}>
        <CardHeader>
          <CardTitle>Laporan Laba Rugi</CardTitle>
          <CardDescription>
            Periode: {dateRange?.from ? format(dateRange.from, 'd MMMM yyyy', { locale: id }) : '...'} - {dateRange?.to ? format(dateRange.to, 'd MMMM yyyy', { locale: id }) : '...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Jumlah (Rp)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderSection("Pendapatan", reportData.revenues, reportData.totalRevenue)}
                
                {renderSection("Beban Pokok Penjualan", reportData.cogs, reportData.totalCogs)}

                <TableRow className="font-bold bg-muted/50">
                    <TableCell>Laba Kotor</TableCell>
                    <TableCell className="text-right font-mono">{reportData.grossProfit.toLocaleString('id-ID')}</TableCell>
                </TableRow>

                {renderSection("Beban", reportData.expenses, reportData.totalExpense)}
              </TableBody>
              <TableFooter>
                <TableRow className="text-lg font-bold bg-secondary/50 hover:bg-secondary">
                  <TableCell>Laba Bersih</TableCell>
                  <TableCell className={cn("text-right font-mono", reportData.netIncome < 0 && "text-destructive")}>{reportData.netIncome.toLocaleString('id-ID')}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
