
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductionCompletion } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Package, DollarSign } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartTooltipContent, ChartContainer } from "@/components/ui/chart";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductionMetric {
    totalUnitsProduced: number;
    totalProductionCost: number;
}

interface ProductProductionSummary {
    productName: string;
    totalQuantity: number;
}

export default function ProductionReportPage() {
    const [completions, setCompletions] = useState<ProductionCompletion[]>([]);
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
        if (!dateRange?.from) return;
        setLoading(true);

        const from = Timestamp.fromDate(dateRange.from);
        const toDayEnd = new Date(dateRange.to || dateRange.from);
        toDayEnd.setHours(23, 59, 59, 999);
        const to = Timestamp.fromDate(toDayEnd);

        const q = query(collection(db, 'productionCompletions'), where("date", ">=", from), where("date", "<=", to), orderBy('date', 'desc'));

        const unsub = onSnapshot(q, (snapshot) => {
            setCompletions(snapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, date: data.date.toDate() } as ProductionCompletion;
            }));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching production completions:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [dateRange]);

    const { metrics, productSummary } = useMemo(() => {
        const metrics: ProductionMetric = {
            totalUnitsProduced: 0,
            totalProductionCost: 0,
        };

        const productMap: { [key: string]: number } = {};

        completions.forEach(pc => {
            metrics.totalUnitsProduced += pc.quantityProduced;
            metrics.totalProductionCost += pc.totalCost;

            if (!productMap[pc.finishedGoodName]) {
                productMap[pc.finishedGoodName] = 0;
            }
            productMap[pc.finishedGoodName] += pc.quantityProduced;
        });

        const productSummary: ProductProductionSummary[] = Object.entries(productMap)
            .map(([productName, totalQuantity]) => ({ productName, totalQuantity }))
            .sort((a, b) => b.totalQuantity - a.totalQuantity);

        return { metrics, productSummary };
    }, [completions]);

    const top5Products = useMemo(() => productSummary.slice(0, 5), [productSummary]);

    const getMonthName = (month: number) => new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-headline font-bold">Laporan Produksi</h2>
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
                        <Download className="mr-2 h-4 w-4" />
                        Ekspor PDF
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                        <MetricCard title="Total Unit Diproduksi" value={metrics.totalUnitsProduced} icon={Package} />
                        <MetricCard title="Total Biaya Produksi" value={metrics.totalProductionCost} format="currency" icon={DollarSign} />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Produk Teratas (Berdasarkan Kuantitas Produksi)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={{}} className="min-h-[250px] w-full">
                                <BarChart data={top5Products} layout="vertical" margin={{ left: 20 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="productName" type="category" tickLine={false} axisLine={false} stroke="hsl(var(--foreground))" fontSize={12} width={150} />
                                    <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                                    <Bar dataKey="totalQuantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Total Produksi" />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Riwayat Penyelesaian Produksi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Produk Jadi</TableHead>
                                        <TableHead>No. WO</TableHead>
                                        <TableHead className="text-right">Kuantitas</TableHead>
                                        <TableHead className="text-right">Total Biaya</TableHead>
                                        <TableHead className="text-right">Biaya/Unit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completions.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24">Tidak ada data produksi untuk periode ini.</TableCell></TableRow>
                                    ) : (
                                        completions.map(pc => (
                                            <TableRow key={pc.id}>
                                                <TableCell>{format(pc.date, "dd MMM yyyy", { locale: id })}</TableCell>
                                                <TableCell className="font-medium">{pc.finishedGoodName}</TableCell>
                                                <TableCell className="font-mono text-xs">{pc.workOrderId}</TableCell>
                                                <TableCell className="text-right">{pc.quantityProduced.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                                <TableCell className="text-right font-mono">Rp {pc.totalCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                                <TableCell className="text-right font-mono">Rp {(pc.totalCost / pc.quantityProduced).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
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
