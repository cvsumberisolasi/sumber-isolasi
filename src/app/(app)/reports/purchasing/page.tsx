
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PurchaseOrder } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, ShoppingCart, Truck, Download } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartTooltip, ChartTooltipContent, ChartContainer } from "@/components/ui/chart";
import { Badge } from '@/components/ui/badge';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface PurchaseMetric {
    totalValue: number;
    totalOrders: number;
    supplierCount: number;
}

interface SupplierPurchaseSummary {
    supplierName: string;
    totalValue: number;
}

export default function PurchasingReportPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    const newFrom = new Date(year, month - 1, 1);
    const newTo = endOfMonth(newFrom);
    setDateRange({ from: newFrom, to: newTo });
  }, [year, month]);

  useEffect(() => {
    if (!dateRange?.from) return;
    setLoading(true);
    
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
    
    let q = query(collection(db, 'purchaseOrders'), where("date", ">=", from), where("date", "<=", to), orderBy('date', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
        setPurchaseOrders(snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, date: data.date.toDate() } as PurchaseOrder;
        }));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching purchase orders:", error);
        setLoading(false);
    });

    return () => unsub();
  }, [dateRange]);

  const { metrics, supplierSummary } = useMemo(() => {
    const metrics: PurchaseMetric = {
      totalValue: 0,
      totalOrders: purchaseOrders.length,
      supplierCount: 0,
    };
    
    const supplierMap: { [key: string]: number } = {};
    const uniqueSuppliers = new Set<string>();

    purchaseOrders.forEach(po => {
      metrics.totalValue += po.total;
      uniqueSuppliers.add(po.supplierId);
      
      if (!supplierMap[po.supplierName]) {
          supplierMap[po.supplierName] = 0;
      }
      supplierMap[po.supplierName] += po.total;
    });

    metrics.supplierCount = uniqueSuppliers.size;

    const supplierSummary: SupplierPurchaseSummary[] = Object.entries(supplierMap)
        .map(([supplierName, totalValue]) => ({ supplierName, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue);

    return { metrics, supplierSummary };
  }, [purchaseOrders]);
  
  const top5Suppliers = useMemo(() => supplierSummary.slice(0, 5), [supplierSummary]);

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
    doc.text('Laporan Pembelian', 105, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.text(period, 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Ringkasan Metrik Pembelian", 14, y);
    y+= 6;
    autoTable(doc, {
        startY: y,
        body: [
            ['Total Nilai Pembelian', `Rp ${metrics.totalValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
            ['Total Pesanan (PO)', `${metrics.totalOrders.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
            ['Jumlah Pemasok', `${metrics.supplierCount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`],
        ],
        theme: 'grid',
    });

    y = (doc as any).autoTable.previous.finalY + 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Riwayat Pesanan Pembelian", 14, y);
    y += 6;

    const tableData = purchaseOrders.map(po => [
      format(po.date, "dd MMM yyyy", { locale: id }),
      po.id,
      po.supplierName,
      po.status,
      `Rp ${po.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Tanggal', 'No. PO', 'Pemasok', 'Status', 'Total']],
        body: tableData,
        theme: 'striped',
        styles: { cellPadding: 2, fontSize: 8 },
        columnStyles: {
            4: { halign: 'right' },
        }
    });
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Dicetak pada ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, doc.internal.pageSize.getHeight() - 10);
    
    doc.save(`laporan-pembelian-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });

  return (
    <Dialog onOpenChange={(open) => !open && setSelectedPO(null)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-headline font-bold">Laporan Pembelian</h1>
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard title="Total Nilai Pembelian" value={metrics.totalValue} format="currency" icon={DollarSign} />
              <MetricCard title="Total Pesanan (PO)" value={metrics.totalOrders} icon={ShoppingCart} />
              <MetricCard title="Jumlah Pemasok" value={metrics.supplierCount} icon={Truck} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Total Pembelian per Pemasok</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="min-h-[250px] w-full">
                        <BarChart data={top5Suppliers} layout="vertical" margin={{ left: 20 }}>
                             <XAxis type="number" hide />
                             <YAxis dataKey="supplierName" type="category" tickLine={false} axisLine={false} stroke="hsl(var(--foreground))" fontSize={12} width={150} />
                             <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                             <Bar dataKey="totalValue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Total Pembelian"/>
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Riwayat Pesanan Pembelian</CardTitle>
                <CardDescription>
                  Daftar pesanan pembelian untuk periode yang dipilih.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>No. PO</TableHead>
                        <TableHead>Pemasok</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purchaseOrders.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Tidak ada pesanan pembelian.</TableCell></TableRow>
                        ) : (
                        purchaseOrders.map(po => (
                            <TableRow key={po.id}>
                                <TableCell>{format(po.date, "dd MMM yyyy", { locale: id })}</TableCell>
                                <TableCell>
                                <DialogTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto font-mono text-xs" onClick={() => setSelectedPO(po)}>
                                    {po.id}
                                    </Button>
                                </DialogTrigger>
                                </TableCell>
                                <TableCell>{po.supplierName}</TableCell>
                                <TableCell><Badge variant={po.status === 'Completed' ? 'secondary' : (po.status === 'Draft' ? 'outline' : 'default')}>{po.status}</Badge></TableCell>
                                <TableCell className="text-right font-mono">Rp {po.total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                            </TableRow>
                        ))
                        )}
                    </TableBody>
                    </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {selectedPO && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail PO: #{selectedPO.id}</DialogTitle>
            <DialogDescription>
              Pemasok: {selectedPO.supplierName} | Tanggal: {format(selectedPO.date, "dd MMM yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Kuantitas</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPO.items.map(item => (
                  <TableRow key={item.productId}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">Rp {item.cost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right font-mono">Rp {(item.cost * item.quantity).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      )}
    </Dialog>
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
        ? `Rp ${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` 
        : value.toLocaleString('id-ID', { maximumFractionDigits: 0 });

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

    
