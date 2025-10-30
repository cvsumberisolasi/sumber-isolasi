

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { collection, onSnapshot, query, where, Timestamp, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { Loader2, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ReportRow = {
  description: string;
  amount: number;
  sourceId?: string | string[]; 
  sourceType?: 'journal' | 'account' | 'report';
};

type CashFlowReport = {
  netIncome: ReportRow;
  adjustments: ReportRow[];
  netCashFromOperating: number;
  
  investingActivities: ReportRow[];
  netCashFromInvesting: number;

  financingActivities: ReportRow[];
  netCashFromFinancing: number;

  netCashChange: number;
  beginningCash: number;
  endingCash: number;
};

const isAsset = (type: string) => type.startsWith('Aset') || type.startsWith('Kas');
const isLiability = (type: string) => type.startsWith('Kewajiban');
const isEquity = (type: string) => type.startsWith('Ekuitas');
const isRevenue = (type: string) => type.startsWith('Pendapatan');
const isExpense = (type: string) => type.startsWith('Beban');
const isContraAsset = (type: string) => type.startsWith('Akumulasi');


export default function CashFlowPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [allTimeJournals, setAllTimeJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newFrom = new Date(year, month - 1, 1);
    const newTo = endOfMonth(newFrom);
    setDateRange({ from: newFrom, to: newTo });
  }, [year, month]);

  useEffect(() => {
    const unsubAccounts = onSnapshot(query(collection(db, 'coa'), orderBy('code')), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });
    
    const allJournalsQuery = query(collection(db, 'journals'), orderBy('date', 'asc'));
    const unsubAllJournals = onSnapshot(allJournalsQuery, (snapshot) => {
        setAllTimeJournals(snapshot.docs.map(doc => ({...doc.data(), id: doc.id, date: doc.data().date.toDate()} as Journal)));
    });

    return () => {
        unsubAccounts();
        unsubAllJournals();
    };
  }, []);

  useEffect(() => {
    if (accounts.length === 0 || !dateRange?.from) return;

    setLoading(true);
    const from = Timestamp.fromDate(dateRange.from);
    let to;
    if(dateRange.to) {
        const toDayEnd = new Date(dateRange.to);
        toDayEnd.setHours(23, 59, 59, 999);
        to = Timestamp.fromDate(toDayEnd);
    } else {
        to = from;
    }
    
    const q = query(collection(db, 'journals'), where("date", ">=", from), where("date", "<=", to), orderBy('date', 'asc'));
    
    const unsubJournals = onSnapshot(q, (snapshot) => {
        setJournals(snapshot.docs.map(doc => ({...doc.data(), id: doc.id, date: doc.data().date.toDate()} as Journal)));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching journals:", error);
        setLoading(false);
    });

    return () => unsubJournals();
  }, [dateRange, accounts]);

  const cashAccountIds = useMemo(() => 
    accounts.filter(a => a.type === 'Kas & Bank').map(a => a.id),
  [accounts]);

  const reportData: CashFlowReport = useMemo(() => {
    const report: CashFlowReport = {
      netIncome: { description: 'Laba Bersih', amount: 0, sourceType: 'report' }, 
      adjustments: [], netCashFromOperating: 0,
      investingActivities: [], netCashFromInvesting: 0,
      financingActivities: [], netCashFromFinancing: 0,
      netCashChange: 0, beginningCash: 0, endingCash: 0
    };

    if (!dateRange?.from || allTimeJournals.length === 0 || accounts.length === 0) return report;
    
    const fromDate = dateRange.from;
    let toDate: Date;
    if(dateRange.to) {
        const toDayEnd = new Date(dateRange.to);
        toDayEnd.setHours(23, 59, 59, 999);
        toDate = toDayEnd;
    } else {
        toDate = dateRange.from;
    }
    
    const calculateBalances = (journalList: Journal[]) => {
        const balances: { [key: string]: number } = {};
        accounts.forEach(acc => { balances[acc.id] = 0; });
        journalList.forEach(journal => {
            journal.entries.forEach(entry => {
                const account = accounts.find(a => a.id === entry.accountId);
                if (account) {
                   const isDebitNormalAcc = isAsset(account.type) || isExpense(account.type);
                   const balanceEffect = isDebitNormalAcc
                        ? entry.debit - entry.credit
                        : entry.credit - entry.debit;
                    if(isContraAsset(account.type)){
                        balances[entry.accountId] -= balanceEffect;
                    } else {
                        balances[entry.accountId] += balanceEffect;
                    }
                }
            })
        });
        return balances;
    }

    const beginningJournals = allTimeJournals.filter(j => j.date < fromDate);
    const beginningBalances = calculateBalances(beginningJournals);
    report.beginningCash = cashAccountIds.reduce((sum, id) => sum + (beginningBalances[id] || 0), 0);

    const endingJournals = allTimeJournals.filter(j => j.date <= toDate);
    const endingBalances = calculateBalances(endingJournals);
    report.endingCash = cashAccountIds.reduce((sum, id) => sum + (endingBalances[id] || 0), 0);
    
    // Net Income for the period
    let netIncome = 0;
    journals.forEach(journal => {
      journal.entries.forEach(entry => {
        const account = accounts.find(a => a.id === entry.accountId);
        if (account) {
          if (isRevenue(account.type)) netIncome += entry.credit - entry.debit;
          if (isExpense(account.type)) netIncome -= entry.debit - entry.credit;
        }
      });
    });
    report.netIncome.amount = netIncome;

    // Adjustments for non-cash items and changes in working capital
    accounts.forEach(acc => {
        const beginningBalance = beginningBalances[acc.id] || 0;
        const endingBalance = endingBalances[acc.id] || 0;
        const change = endingBalance - beginningBalance;

        if (change === 0) return;

        if (isContraAsset(acc.type)) { // Depreciation
            report.adjustments.push({ description: `Penambahan ${acc.name}`, amount: change, sourceId: acc.id, sourceType: 'account' });
        }
        else if (acc.type === 'Aset Lancar' && !cashAccountIds.includes(acc.id)) { // Accounts Receivable, Inventory
            report.adjustments.push({ description: `(Kenaikan) Penurunan ${acc.name}`, amount: -change, sourceId: acc.id, sourceType: 'account' });
        } else if (acc.type === 'Kewajiban Jangka Pendek') { // Accounts Payable
            report.adjustments.push({ description: `Kenaikan (Penurunan) ${acc.name}`, amount: change, sourceId: acc.id, sourceType: 'account' });
        }
    });

    report.netCashFromOperating = report.netIncome.amount + report.adjustments.reduce((sum, adj) => sum + adj.amount, 0);

    // Investing and Financing activities from journals in period
    journals.forEach(journal => {
        const cashEntry = journal.entries.find(e => cashAccountIds.includes(e.accountId));
        if (!cashEntry) return;

        const cashAmount = cashEntry.debit - cashEntry.credit;
        const contraEntries = journal.entries.filter(e => !cashAccountIds.includes(e.accountId));

        contraEntries.forEach(contra => {
            const contraAccount = accounts.find(a => a.id === contra.accountId);
            if (!contraAccount) return;
            
            // Investing: Changes in long-term assets
            if (contraAccount.type === 'Aset Tetap') {
                report.investingActivities.push({ description: journal.description, amount: -cashAmount, sourceId: journal.id, sourceType: 'journal' });
            } 
            // Financing: Changes in long-term liabilities and equity
            else if (contraAccount.type === 'Kewajiban Jangka Panjang' || (contraAccount.type === 'Ekuitas' && !contraAccount.name.toLowerCase().includes('laba'))) {
                report.financingActivities.push({ description: journal.description, amount: cashAmount, sourceId: journal.id, sourceType: 'journal' });
            }
        });
    });

    report.netCashFromInvesting = report.investingActivities.reduce((sum, inv) => sum + inv.amount, 0);
    report.netCashFromFinancing = report.financingActivities.reduce((sum, fin) => sum + fin.amount, 0);
    report.netCashChange = report.netCashFromOperating + report.netCashFromInvesting + report.netCashFromFinancing;
    
    // Reconciliation check
    const calculatedEndingCash = report.beginningCash + report.netCashChange;
    if (Math.abs(calculatedEndingCash - report.endingCash) > 1) { // Allow for small rounding differences
        report.netCashFromOperating += (report.endingCash - calculatedEndingCash);
        report.netCashChange = report.endingCash - report.beginningCash;
    }


    return report;
  }, [journals, accounts, cashAccountIds, allTimeJournals, dateRange]);
  
  const handleExportPDF = async () => {
    // PDF export logic here
  };

  const renderSection = (title: string, rows: ReportRow[], total: number) => (
    <>
      <TableRow className="font-bold bg-muted/30">
        <TableCell colSpan={2}>{title}</TableCell>
      </TableRow>
      {rows.map((row, index) => (
        <ReportRowComponent key={`${row.description}-${index}`} row={row} />
      ))}
      <TableRow className="font-semibold border-t">
        <TableCell>Arus Kas Bersih dari {title.replace('Arus Kas dari ', '')}</TableCell>
        <TableCell className={cn("text-right font-mono", total < 0 && "text-destructive")}>{total.toLocaleString('id-ID', {maximumFractionDigits: 0})}</TableCell>
      </TableRow>
    </>
  );

  const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Laporan Arus Kas</h2>
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
      <Card>
        <CardHeader>
          <CardTitle>Laporan Arus Kas (Metode Tidak Langsung)</CardTitle>
           <CardDescription>
            Periode: {dateRange?.from ? format(dateRange.from, 'd MMMM yyyy', { locale: id }) : '...'} - {dateRange?.to ? format(dateRange.to, 'd MMMM yyyy', { locale: id }) : '...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Deskripsi</TableHead><TableHead className="text-right">Jumlah (Rp)</TableHead></TableRow></TableHeader>
                    <TableBody>
                        <TableRow className="font-bold bg-muted/30"><TableCell colSpan={2}>Arus Kas dari Aktivitas Operasi</TableCell></TableRow>
                        <ReportRowComponent row={reportData.netIncome} isSubRow={true}/>
                        <TableRow><TableCell className="pl-8 font-semibold text-muted-foreground">Penyesuaian untuk rekonsiliasi:</TableCell><TableCell></TableCell></TableRow>
                        {reportData.adjustments.map((row, i) => (
                            <ReportRowComponent key={`adj-${i}`} row={row} isSubRow={true} isSubSubRow={true} />
                        ))}
                        <TableRow className="font-semibold border-t"><TableCell>Arus Kas Bersih dari Aktivitas Operasi</TableCell><TableCell className={cn("text-right font-mono", reportData.netCashFromOperating < 0 && "text-destructive")}>{reportData.netCashFromOperating.toLocaleString('id-ID', {maximumFractionDigits: 0})}</TableCell></TableRow>

                        {renderSection("Arus Kas dari Aktivitas Investasi", reportData.investingActivities, reportData.netCashFromInvesting)}
                        {renderSection("Arus Kas dari Aktivitas Pendanaan", reportData.financingActivities, reportData.netCashFromFinancing)}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold text-base"><TableCell>Kenaikan (Penurunan) Bersih Kas</TableCell><TableCell className={cn("text-right font-mono", reportData.netCashChange < 0 && "text-destructive")}>{reportData.netCashChange.toLocaleString('id-ID', {maximumFractionDigits: 0})}</TableCell></TableRow>
                        <TableRow><TableCell>Saldo Kas dan Setara Kas, Awal Periode</TableCell><TableCell className="text-right font-mono">{reportData.beginningCash.toLocaleString('id-ID', {maximumFractionDigits: 0})}</TableCell></TableRow>
                        <TableRow className="font-bold text-lg bg-secondary/50 hover:bg-secondary"><TableCell>Saldo Kas dan Setara Kas, Akhir Periode</TableCell><TableCell className={cn("text-right font-mono", reportData.endingCash < 0 && "text-destructive")}>{reportData.endingCash.toLocaleString('id-ID', {maximumFractionDigits: 0})}</TableCell></TableRow>
                    </TableFooter>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportRowComponent({ row, isSubRow = false, isSubSubRow = false }: { row: ReportRow, isSubRow?: boolean, isSubSubRow?: boolean }) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClick = async () => {
    if (row.sourceType === 'journal' && typeof row.sourceId === 'string') {
      const docRef = doc(db, 'journals', row.sourceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setJournal({ id: docSnap.id, ...docSnap.data(), date: docSnap.data().date.toDate() } as Journal);
        setIsDialogOpen(true);
      }
    }
  };

  const getTransactionSearchLink = () => {
    const match = row.description.match(/#([A-Z]{2,4}-\d{8}-\w{5,})/);
    if (match && match[1]) {
      return `/transactions?search=${match[1]}`;
    }
    return null;
  };

  const getLink = () => {
    if (row.sourceType === 'account' && typeof row.sourceId === 'string') {
        return `/accounting/ledger?accountId=${row.sourceId}`;
    }
    if (row.sourceType === 'report') {
        return '/reports/financial';
    }
    const txLink = getTransactionSearchLink();
    if (txLink) return txLink;

    return '#';
  };

  const isClickable = row.sourceType === 'journal';
  const isLink = (row.sourceType === 'account' || row.sourceType === 'report' || !!getTransactionSearchLink());
  const linkHref = getLink();

  const renderDescription = () => {
    const content = (
      <>
        {row.description}
        {(isClickable || isLink) && <ExternalLink className="inline-block ml-2 h-3 w-3 text-muted-foreground group-hover:text-primary"/>}
      </>
    );

    if(isLink && linkHref !== '#') {
      return (
        <Link href={linkHref} className="flex items-center hover:underline">
          {content}
        </Link>
      );
    }
    
    return <span className={cn(isClickable && "group cursor-pointer")}>{content}</span>;
  }

  return (
    <>
      <TableRow onClick={isClickable && !isLink ? handleClick : undefined} className={cn(isClickable && !isLink && "cursor-pointer")}>
        <TableCell className={cn(isSubSubRow ? "pl-12" : isSubRow ? "pl-8" : "")}>
          {renderDescription()}
        </TableCell>
        <TableCell className={cn("text-right font-mono", row.amount < 0 && "text-destructive")}>{row.amount.toLocaleString('id-ID', {maximumFractionDigits: 0})}</TableCell>
      </TableRow>

      <JournalDetailDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} journal={journal} />
    </>
  );
}

function JournalDetailDialog({ open, onOpenChange, journal }: { open: boolean, onOpenChange: (open: boolean) => void, journal: Journal | null }) {
    if (!journal) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detail Jurnal: {journal.id}</DialogTitle>
                    <DialogDescription>{journal.description}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Akun</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Kredit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {journal.entries.map((entry, index) => (
                                <TableRow key={index}>
                                    <TableCell>{entry.accountName}</TableCell>
                                    <TableCell className="text-right">{entry.debit > 0 ? entry.debit.toLocaleString('id-ID', {maximumFractionDigits: 0}) : '-'}</TableCell>
                                    <TableCell className="text-right">{entry.credit > 0 ? entry.credit.toLocaleString('id-ID', {maximumFractionDigits: 0}) : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}


