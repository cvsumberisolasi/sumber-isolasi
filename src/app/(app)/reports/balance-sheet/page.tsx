
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import autoTable from 'jspdf-autotable';
import { DatePicker } from '@/components/ui/date-picker';


type ReportRow = {
  accountId: string;
  accountName: string;
  amount: number;
};

type BalanceSheetReport = {
  currentAssets: ReportRow[];
  fixedAssets: ReportRow[];
  otherAssets: ReportRow[];
  shortTermLiabilities: ReportRow[];
  longTermLiabilities: ReportRow[];
  equity: ReportRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

const isAsset = (type: string) => type.startsWith('Aset') || type.startsWith('Kas');
const isLiability = (type: string) => type.startsWith('Kewajiban');
const isEquity = (type: string) => type.startsWith('Ekuitas');
const isRevenue = (type: string) => type.startsWith('Pendapatan');
const isExpense = (type: string) => type.startsWith('Beban');
const isContraAsset = (type: string) => type.startsWith('Akumulasi');


export default function BalanceSheetPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newTo = endOfMonth(new Date(year, month - 1, 1));
    setReportDate(newTo);
  }, [year, month]);

  useEffect(() => {
    const unsubAccounts = onSnapshot(query(collection(db, 'coa'), orderBy('code')), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });
    return () => unsubAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length === 0 || !reportDate) return;

    setLoading(true);
    let to;
    if(reportDate) {
        const endDate = new Date(reportDate);
        endDate.setHours(23, 59, 59, 999);
        to = Timestamp.fromDate(endDate);
    } else {
        to = Timestamp.now();
    }
    
    const journalsUptoEndDateQuery = query(collection(db, 'journals'), where("date", "<=", to), orderBy('date', 'asc'));

    const unsubJournals = onSnapshot(journalsUptoEndDateQuery, (snapshot) => {
        setJournals(snapshot.docs.map(doc => ({...doc.data(), id: doc.id, date: doc.data().date.toDate()} as Journal)));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching journals:", error);
        setLoading(false);
    });

    return () => unsubJournals();
  }, [reportDate, accounts]);


  const reportData: BalanceSheetReport = useMemo(() => {
    const report: BalanceSheetReport = {
        currentAssets: [], fixedAssets: [], otherAssets: [],
        shortTermLiabilities: [], longTermLiabilities: [],
        equity: [],
        totalAssets: 0, totalLiabilities: 0, totalEquity: 0
    };

    if (!reportDate || accounts.length === 0) return report;
    
    const balances: { [key: string]: number } = {};
    accounts.forEach(acc => { balances[acc.id] = 0; });
    
    journals.forEach(journal => {
        journal.entries.forEach(entry => {
            const account = accounts.find(a => a.id === entry.accountId);
            if (account && balances[entry.accountId] !== undefined) {
               const isDebitNormalAcc = isAsset(account.type) || isExpense(account.type);
               const balanceEffect = isDebitNormalAcc ? entry.debit - entry.credit : entry.credit - entry.debit;
               
               // Contra asset like accumulated depreciation is an asset but has a credit normal balance
               if(isContraAsset(account.type)) {
                   balances[entry.accountId] -= balanceEffect; // Re-negate to get positive credit balance
               } else {
                   balances[entry.accountId] += balanceEffect;
               }
            }
        });
    });
    
    let totalRevenue = 0;
    let totalExpense = 0;

    accounts.forEach(account => {
        const balance = balances[account.id] || 0;
        
        const row = { accountId: account.id, accountName: account.name, amount: balance };

        if (isAsset(account.type)) {
            if (balance === 0) return;
             if (isContraAsset(account.type)) {
                report.fixedAssets.push({ ...row, amount: -balance }); // Show as negative to reduce asset value
            } else if (account.type === 'Aset Lancar' || account.type === 'Kas & Bank') {
                report.currentAssets.push(row);
            } else if (account.type === 'Aset Tetap') {
                report.fixedAssets.push(row);
            } else {
                report.otherAssets.push(row);
            }
        } else if (isLiability(account.type)) {
            if (balance === 0) return;
            if (account.type === 'Kewajiban Jangka Pendek') report.shortTermLiabilities.push(row);
            else report.longTermLiabilities.push(row);
        } else if (isEquity(account.type)) {
            // Include equity accounts even if balance is 0 to show structure, but filter out for net income.
            if (balance !== 0 || account.name.toLowerCase().includes('laba ditahan')) {
              report.equity.push(row);
            }
        } else if (isRevenue(account.type)) {
            totalRevenue += balance;
        } else if (isExpense(account.type)) {
            totalExpense += balance;
        }
    });

    const netIncome = totalRevenue - totalExpense;
    if (netIncome !== 0) {
        report.equity.push({ accountId: 'retained-earnings-current', accountName: 'Laba/Rugi Tahun Berjalan', amount: netIncome });
    }
    
    const totalCurrentAssets = report.currentAssets.reduce((sum, r) => sum + r.amount, 0);
    const totalFixedAssets = report.fixedAssets.reduce((sum, r) => sum + r.amount, 0);
    const totalOtherAssets = report.otherAssets.reduce((sum, r) => sum + r.amount, 0);
    report.totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;
    
    const totalShortTermLiabilities = report.shortTermLiabilities.reduce((sum, r) => sum + r.amount, 0);
    const totalLongTermLiabilities = report.longTermLiabilities.reduce((sum, r) => sum + r.amount, 0);
    report.totalLiabilities = totalShortTermLiabilities + totalLongTermLiabilities;

    report.totalEquity = report.equity.reduce((sum, r) => sum + r.amount, 0);

    return report;
  }, [journals, accounts, reportDate]);
  
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const settings = await getCompanySettings();
    const companyName = settings.companyName || 'Toko Kilat';
    const period = `Per tanggal: ${reportDate ? format(reportDate, 'd MMMM yyyy', { locale: id }) : '...'}`;
    let y = 15;

    if (settings.logoDataUrl) {
      doc.addImage(settings.logoDataUrl, 'PNG', 14, y, 20, 20);
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 105, y + 5, { align: 'center' });
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Posisi Keuangan', 105, y + 5, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.text(period, 105, y + 5, { align: 'center' });
    y += 15;
    
    const assetBody = [
        [{ content: 'Aset Lancar', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ...reportData.currentAssets.map(r => [({ content: `  ${r.accountName}`}), ({ content: r.amount.toLocaleString('id-ID'), styles: { halign: 'right' } })]),
        [{ content: 'Total Aset Lancar', styles: { fontStyle: 'bold' } }, { content: reportData.currentAssets.reduce((s, r) => s + r.amount, 0).toLocaleString('id-ID'), styles: { halign: 'right' } }],
        [{ content: 'Aset Tetap', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ...reportData.fixedAssets.map(r => [({ content: `  ${r.accountName}`}), ({ content: r.amount.toLocaleString('id-ID'), styles: { halign: 'right' } })]),
        [{ content: 'Total Aset Tetap', styles: { fontStyle: 'bold' } }, { content: reportData.fixedAssets.reduce((s, r) => s + r.amount, 0).toLocaleString('id-ID'), styles: { halign: 'right' } }]
    ];
     autoTable(doc, {
        startY: y,
        head: [['Aset', '']],
        body: assetBody,
        theme: 'plain',
        tableWidth: 90,
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30 } },
        didDrawPage: (data) => { data.cursor!.x = 115; data.cursor!.y = y; }
    });

    const liabEquityBody = [
        [{ content: 'Kewajiban Jangka Pendek', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ...reportData.shortTermLiabilities.map(r => [({ content: `  ${r.accountName}`}), ({ content: r.amount.toLocaleString('id-ID'), styles: { halign: 'right' } })]),
        [{ content: 'Total Kewajiban Jangka Pendek', styles: { fontStyle: 'bold' } }, { content: reportData.shortTermLiabilities.reduce((s, r) => s + r.amount, 0).toLocaleString('id-ID'), styles: { halign: 'right' } }],
        [{ content: 'Ekuitas', colSpan: 2, styles: { fontStyle: 'bold' } }],
        ...reportData.equity.map(r => [({ content: `  ${r.accountName}`}), ({ content: r.amount.toLocaleString('id-ID'), styles: { halign: 'right' } })]),
    ];
    autoTable(doc, {
        head: [['Kewajiban dan Ekuitas', '']],
        body: liabEquityBody,
        theme: 'plain',
        tableWidth: 90,
        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30 } }
    });
    
    doc.save(`laporan-neraca-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const ReportRowLink = ({ row }: { row: ReportRow }) => {
    const from = reportDate ? format(new Date(reportDate.getFullYear(), 0, 1), 'yyyy-MM-dd') : '';
    const to = reportDate ? format(reportDate, 'yyyy-MM-dd') : from;
    const link = `/accounting/ledger?accountId=${row.accountId}&from=${from}&to=${to}`;
    
    if (row.accountId === 'retained-earnings-current') {
        return (
             <TableRow>
                <TableCell className="pl-8">
                    <Link href="/reports/financial" className="flex items-center hover:underline">
                        {row.accountName}
                        <ExternalLink className="inline-block ml-2 h-3 w-3 text-muted-foreground"/>
                    </Link>
                </TableCell>
                <TableCell className="text-right font-mono">{row.amount.toLocaleString('id-ID')}</TableCell>
            </TableRow>
        )
    }

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

  const renderSection = (title: string, rows: ReportRow[], total: number) => (
    <>
      <TableRow className="font-bold bg-muted/30">
        <TableCell>{title}</TableCell>
        <TableCell></TableCell>
      </TableRow>
      {rows.map((row) => (
        <ReportRowLink key={row.accountId} row={row} />
      ))}
      <TableRow className="font-semibold border-t">
        <TableCell className="pl-8">Total {title}</TableCell>
        <TableCell className="text-right font-mono">{total.toLocaleString('id-ID')}</TableCell>
      </TableRow>
    </>
  );

  const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Laporan Posisi Keuangan (Neraca)</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
                <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Button onClick={handleExportPDF} variant="outline" className="w-full sm:w-auto" disabled={loading}>
                <Download className="mr-2 h-4 w-4"/>
                Ekspor PDF
            </Button>
        </div>
      </div>
      <Card ref={reportRef}>
        <CardHeader>
          <CardTitle>Neraca</CardTitle>
          <CardDescription>
            Posisi Keuangan per tanggal: {reportDate ? format(reportDate, 'd MMMM yyyy', { locale: id }) : '...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                {/* ASET */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead className="text-lg">Aset</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                            {renderSection("Aset Lancar", reportData.currentAssets, reportData.currentAssets.reduce((s, r) => s + r.amount, 0))}
                            {renderSection("Aset Tetap", reportData.fixedAssets, reportData.fixedAssets.reduce((s, r) => s + r.amount, 0))}
                            {renderSection("Aset Lainnya", reportData.otherAssets, reportData.otherAssets.reduce((s, r) => s + r.amount, 0))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="text-lg font-bold bg-secondary/50 hover:bg-secondary">
                                <TableCell>Total Aset</TableCell>
                                <TableCell className="text-right font-mono">{reportData.totalAssets.toLocaleString('id-ID')}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                {/* KEWAJIBAN & EKUITAS */}
                <div className="overflow-x-auto">
                     <Table>
                        <TableHeader><TableRow><TableHead className="text-lg">Kewajiban dan Ekuitas</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                            {renderSection("Kewajiban Jangka Pendek", reportData.shortTermLiabilities, reportData.shortTermLiabilities.reduce((s, r) => s + r.amount, 0))}
                            {renderSection("Kewajiban Jangka Panjang", reportData.longTermLiabilities, reportData.longTermLiabilities.reduce((s, r) => s + r.amount, 0))}
                             <TableRow className="font-bold bg-muted/30">
                                <TableCell colSpan={2}>Ekuitas</TableCell>
                            </TableRow>
                            {reportData.equity.map((row) => (
                                <ReportRowLink key={row.accountId} row={row}/>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="text-lg font-bold bg-secondary/50 hover:bg-secondary">
                                <TableCell>Total Kewajiban dan Ekuitas</TableCell>
                                <TableCell className="text-right font-mono">{(reportData.totalLiabilities + reportData.totalEquity).toLocaleString('id-ID')}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

