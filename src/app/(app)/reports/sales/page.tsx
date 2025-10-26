
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, ProductSalesSummary, SalesMetric, SalesTrendData, Product, TransactionItem } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, ShoppingCart, Package, TrendingUp, Download } from 'lucide-react';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartTooltip, ChartTooltipContent, ChartContainer } from "@/components/ui/chart";
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function SalesReportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedProductSummary, setSelectedProductSummary] = useState<ProductSalesSummary | null>(null);

  useEffect(() => {
    const newFrom = new Date(year, month - 1, 1);
    const newTo = endOfMonth(newFrom);
    setDateRange({ from: newFrom, to: newTo });
  }, [year, month]);
  
  useEffect(() => {
    setLoading(true);

    const productsUnsub = onSnapshot(collection(db, 'products'), (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    let q = query(collection(db, 'transactions'), orderBy('date', 'desc'));

    if (dateRange?.from) {
        const from = Timestamp.fromDate(dateRange.from);
        let to;
        if (dateRange.to) {
          const toDayEnd = new Date(dateRange.to);
          toDayEnd.setHours(23, 59, 59, 999);
          to = Timestamp.fromDate(toDayEnd);
        } else {
          const fromDayEnd = new Date(dateRange.from);
          fromDayEnd.setHours(23, 59, 59, 999);
          to = Timestamp.fromDate(fromDayEnd);
        }
        
        q = query(collection(db, 'transactions'), where("date", ">=", from), where("date", "<=", to), orderBy("date", "asc"));
    }

    const transUnsub = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, date: data.date.toDate() } as Transaction;
        }));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching transactions:", error);
        setLoading(false);
    });

    return () => {
        transUnsub();
        productsUnsub();
    };
  }, [dateRange]);

  const { metrics, productSummary, salesTrend } = useMemo(() => {
    const metrics: SalesMetric = {
      grossSales: 0,
      totalTransactions: transactions.length,
      avgTransactionValue: 0,
      productsSold: 0,
    };
    
    const productSummaryMap: { [key: string]: ProductSalesSummary } = {};
    const salesTrendMap: { [key: string]: number } = {};

    transactions.forEach(tx => {
      metrics.grossSales += tx.total;
      
      const dateKey = format(tx.date, 'yyyy-MM-dd');
      if (!salesTrendMap[dateKey]) salesTrendMap[dateKey] = 0;
      salesTrendMap[dateKey] += tx.total;

      tx.items.forEach(item => {
        metrics.productsSold += item.quantity;
        const product = products.find(p => p.id === item.productId);
        const cost = product?.cost || item.cost || 0; // use master product cost if available

        if (!productSummaryMap[item.productId]) {
          productSummaryMap[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            quantitySold: 0,
            grossRevenue: 0,
            grossProfit: 0,
          };
        }
        const summary = productSummaryMap[item.productId];
        summary.quantitySold += item.quantity;
        summary.grossRevenue += item.price * item.quantity;
        summary.grossProfit += (item.price - cost) * item.quantity;
      });
    });

    if (metrics.totalTransactions > 0) {
      metrics.avgTransactionValue = metrics.grossSales / metrics.totalTransactions;
    }

    const productSummary = Object.values(productSummaryMap).sort((a, b) => b.grossRevenue - a.grossRevenue);
    
    const salesTrend: SalesTrendData[] = Object.entries(salesTrendMap)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { metrics, productSummary, salesTrend };
  }, [transactions, products]);
  
  const top5Products = useMemo(() => {
    return [...productSummary].sort((a,b) => b.quantitySold - a.quantitySold).slice(0, 5);
  }, [productSummary]);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    autoTable(doc, {
        headStyles: { fillColor: [15, 23, 42] },
        styles: { font: 'helvetica' },
    });
    const settings = await getCompanySettings();
    const companyName = settings.companyName || 'Toko Kilat';
    const period = `Periode: ${dateRange?.from ? format(dateRange.from, 'd MMMM yyyy', { locale: id }) : '...'} - ${dateRange?.to ? format(dateRange.to, 'd MMMM yyyy', { locale: id }) : '...'}`;
    
    let y = 15;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 105, y, { align: 'center' });
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Penjualan', 105, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.text(period, 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Ringkasan Metrik Penjualan", 14, y);
    y+= 6;
    autoTable(doc, {
        startY: y,
        body: [
            ['Penjualan Kotor', `Rp ${metrics.grossSales.toLocaleString('id-ID')}`],
            ['Total Transaksi', `${metrics.totalTransactions.toLocaleString('id-ID')}`],
            ['Rata-rata Transaksi', `Rp ${metrics.avgTransactionValue.toLocaleString('id-ID')}`],
            ['Produk Terjual', `${metrics.productsSold.toLocaleString('id-ID')}`],
        ],
        theme: 'grid',
    });

    y = (doc as any).autoTable.previous.finalY + 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Rangkuman Penjualan per Produk", 14, y);
    y += 6;

    const tableData = productSummary.map(p => [
      p.productName,
      p.quantitySold.toLocaleString('id-ID'),
      `Rp ${p.grossRevenue.toLocaleString('id-ID')}`,
      `Rp ${p.grossProfit.toLocaleString('id-ID')}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Produk', 'Kuantitas Terjual', 'Pendapatan Kotor', 'Laba Kotor']],
        body: tableData,
        theme: 'striped',
        styles: { cellPadding: 2, fontSize: 8 },
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        }
    });
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Dicetak pada ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, doc.internal.pageSize.getHeight() - 10);
    
    doc.save(`laporan-penjualan-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const productTransactions = useMemo(() => {
    if (!selectedProductSummary) return [];
    return transactions.filter(tx => tx.items.some(item => item.productId === selectedProductSummary.productId));
  }, [selectedProductSummary, transactions]);

  const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">Laporan Penjualan</h2>
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
      
      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Penjualan Kotor" value={metrics.grossSales} format="currency" icon={DollarSign} />
            <MetricCard title="Total Transaksi" value={metrics.totalTransactions} icon={ShoppingCart} />
            <MetricCard title="Rata-rata Transaksi" value={metrics.avgTransactionValue} format="currency" icon={TrendingUp} />
            <MetricCard title="Produk Terjual" value={metrics.productsSold} icon={Package} />
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                  <CardHeader>
                      <CardTitle>Tren Penjualan Harian</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <ChartContainer config={{}} className="min-h-[250px] w-full">
                          <LineChart data={salesTrend}>
                              <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'dd MMM', { locale: id })} stroke="hsl(var(--foreground))" fontSize={12} />
                              <YAxis tickFormatter={(val) => `Rp${Number(val) / 1000}k`} stroke="hsl(var(--foreground))" fontSize={12}/>
                              <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                              <Legend />
                              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Penjualan" dot={false}/>
                          </LineChart>
                      </ChartContainer>
                  </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                  <CardHeader>
                      <CardTitle>Produk Terlaris (Kuantitas)</CardTitle>
                  </CardHeader>
                  <CardContent>
                       <ChartContainer config={{}} className="min-h-[250px] w-full">
                          <BarChart data={top5Products} layout="vertical" margin={{ left: 20 }}>
                               <XAxis type="number" hide />
                               <YAxis dataKey="productName" type="category" tickLine={false} axisLine={false} stroke="hsl(var(--foreground))" fontSize={12} width={120} />
                               <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                               <Bar dataKey="quantitySold" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Terjual"/>
                          </BarChart>
                      </ChartContainer>
                  </CardContent>
              </Card>
          </div>

          <Dialog>
            <Card>
              <CardHeader>
                <CardTitle>Rangkuman Penjualan per Produk</CardTitle>
                <CardDescription>
                  Pendapatan Kotor adalah total penjualan sebelum diskon, sedangkan Laba Kotor adalah pendapatan setelah dikurangi HPP.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-right">Kuantitas Terjual</TableHead>
                        <TableHead className="text-right">Pendapatan Kotor</TableHead>
                        <TableHead className="text-right">Laba Kotor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {productSummary.map(p => (
                        <TableRow key={p.productId}>
                            <TableCell>
                            <DialogTrigger asChild>
                                <Button variant="link" className="p-0 h-auto font-medium" onClick={() => setSelectedProductSummary(p)}>
                                    {p.productName}
                                </Button>
                                </DialogTrigger>
                            </TableCell>
                            <TableCell className="text-right">{p.quantitySold}</TableCell>
                            <TableCell className="text-right font-mono">Rp {p.grossRevenue.toLocaleString('id-ID')}</TableCell>
                            <TableCell className="text-right font-mono">Rp {p.grossProfit.toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
              </CardContent>
            </Card>

            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Detail Transaksi untuk: {selectedProductSummary?.productName}</DialogTitle>
                <DialogDescription>
                  Menampilkan semua transaksi yang melibatkan produk ini dalam periode yang dipilih.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>No. Transaksi</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productTransactions.map(tx => {
                        const relevantItem = tx.items.find(item => item.productId === selectedProductSummary?.productId)!;
                        return (
                             <TableRow key={tx.id}>
                                <TableCell>{format(tx.date, 'dd MMM yyyy, HH:mm')}</TableCell>
                                <TableCell className="font-mono">{tx.id}</TableCell>
                                <TableCell className="text-right">{relevantItem.quantity}</TableCell>
                                <TableCell className="text-right font-mono">Rp {(relevantItem.price * relevantItem.quantity).toLocaleString('id-ID')}</TableCell>
                            </TableRow>
                        )
                    })}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
    title: string;
    value: number;
    format?: 'currency' | 'number';
    icon: React.ElementType;
}

function MetricCard({ title, value, format = 'number', icon: Icon }: MetricCardProps) {
    const formattedValue = format === 'currency' 
        ? `Rp ${value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
        : value.toLocaleString('id-ID');

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formattedValue}</div>
            </CardContent>
        </Card>
    );
}

declare module '@/components/ui/date-range-picker' {
    interface DateRangePickerProps {
        onSelect?: (date?: DateRange) => void;
    }
}
