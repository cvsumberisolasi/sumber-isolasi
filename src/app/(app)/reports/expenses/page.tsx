
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, PieChart } from 'lucide-react';
import { Pie, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';
import { ChartTooltipContent, ChartContainer } from "@/components/ui/chart";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLORS, ExpenseCategory, groupExpenses } from '@/lib/expense-helper';

type ExpenseRow = {
  accountId: string;
  accountName: string;
  category: ExpenseCategory;
  amount: number;
};

export default function ExpensesReportPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    const newFrom = new Date(year, month - 1, 1);
    const newTo = endOfMonth(newFrom);
    setDateRange({ from: newFrom, to: newTo });
  }, [year, month]);

  useEffect(() => {
    const unsubAccounts = onSnapshot(query(collection(db, 'coa'), orderBy('code')), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });

    return () => unsubAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length === 0 || !dateRange?.from) return;

    setLoading(true);
    const from = Timestamp.fromDate(dateRange.from);
    const toDayEnd = new Date(dateRange.to || dateRange.from);
    toDayEnd.setHours(23, 59, 59, 999);
    const to = Timestamp.fromDate(toDayEnd);

    const expenseAccountTypes = ['Beban Pokok Penjualan', 'Beban Operasional', 'Beban Lainnya'];
    const expenseAccountIds = accounts.filter(acc => expenseAccountTypes.includes(acc.type)).map(acc => acc.id);
    
    if (expenseAccountIds.length === 0) {
        setLoading(false);
        setJournals([]);
        return;
    }

    const q = query(
      collection(db, 'journals'),
      where('date', '>=', from),
      where('date', '<=', to),
    );

    const unsubJournals = onSnapshot(q, (snapshot) => {
      const relevantJournals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate() } as Journal)).filter(journal =>
        journal.entries.some(entry => expenseAccountIds.includes(entry.accountId))
      );
      setJournals(relevantJournals);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching journals:", error);
      setLoading(false);
    });

    return () => unsubJournals();
  }, [dateRange, accounts]);

  const { expensesByCategory, totalExpenses, expensesByAccount } = useMemo(() => {
    return groupExpenses(journals, accounts);
  }, [journals, accounts]);

  const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Laporan Pengeluaran</h2>
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
            <Button variant="outline" disabled>
                <Download className="mr-2 h-4 w-4"/>
                Ekspor PDF
            </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Total Pengeluaran</CardTitle>
                    <CardDescription>
                        Total pengeluaran untuk periode {dateRange?.from ? format(dateRange.from, 'd MMMM yyyy', { locale: id }) : '...'} - {dateRange?.to ? format(dateRange.to, 'd MMMM yyyy', { locale: id }) : '...'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold text-destructive">Rp {totalExpenses.toLocaleString('id-ID')}</p>
                </CardContent>
            </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Distribusi Pengeluaran</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="min-h-[300px] w-full">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={expensesByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                    {expensesByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Rincian Pengeluaran per Akun</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Akun</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesByAccount.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center h-24">Tidak ada data pengeluaran.</TableCell></TableRow>
                    ) : (
                      expensesByAccount.map(expense => (
                        <TableRow key={expense.accountId}>
                          <TableCell className="font-medium">{expense.accountName}</TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell className="text-right font-mono">Rp {expense.amount.toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
