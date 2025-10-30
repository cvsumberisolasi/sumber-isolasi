
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Handshake, DollarSign, Package, ShoppingCart, AlertCircle, Workflow } from "lucide-react";
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Transaction, SupplierInvoice, WorkOrder, ProductionCompletion } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { WeeklySalesChart } from "@/components/dashboard/weekly-sales-chart";
import { format } from 'date-fns';

export default function DashboardPage() {
  const [dailySales, setDailySales] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [weeklySales, setWeeklySales] = useState<any[]>([]);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);
  const [activeWorkOrders, setActiveWorkOrders] = useState<WorkOrder[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<ProductionCompletion[]>([]);

  useEffect(() => {
    // --- Transactions Listener (Daily Sales & Weekly Trend) ---
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    sevenDaysAgo.setHours(0,0,0,0);
    const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

    const qTransactions = query(collection(db, "transactions"), where("date", ">=", sevenDaysAgoTimestamp));

    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      let totalToday = 0;
      const salesByDay: { [key: string]: number } = { 'Sen': 0, 'Sel': 0, 'Rab': 0, 'Kam': 0, 'Jum': 0, 'Sab': 0, 'Min': 0 };
      const dayMapping = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

      snapshot.docs.forEach(doc => {
        const tx = { ...doc.data(), date: doc.data().date.toDate() } as Transaction;
        const txDate = tx.date;

        if (txDate.getFullYear() === today.getFullYear() &&
            txDate.getMonth() === today.getMonth() &&
            txDate.getDate() === today.getDate()) {
          totalToday += tx.total;
        }

        const dayOfWeek = dayMapping[txDate.getDay()];
        if(salesByDay.hasOwnProperty(dayOfWeek)){
            salesByDay[dayOfWeek] += tx.total;
        }
      });

      setDailySales(totalToday);
      
      const formattedWeeklySales = dayMapping.map(day => ({
        day,
        total: salesByDay[day]
      }));
      setWeeklySales(formattedWeeklySales);
    });

    // --- Products Listener (Low Stock) ---
    const productsCol = collection(db, "products");
    const unsubscribeLowStock = onSnapshot(productsCol, (snapshot) => {
       const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
       const lowStock = allProducts.filter(p => p.stock <= (p.minStockThreshold || 10));
       setLowStockProducts(lowStock);
    });
    
    // --- Receivables Listener ---
    const qReceivables = query(collection(db, 'transactions'), where('status', '==', 'Belum Lunas'));
    const unsubscribeReceivables = onSnapshot(qReceivables, (snapshot) => {
        let total = 0;
        snapshot.forEach(doc => {
            total += (doc.data() as Transaction).total;
        });
        setTotalReceivables(total);
    });

    // --- Payables Listener ---
    const qPayables = query(collection(db, 'supplierInvoices'), where('status', '==', 'Unpaid'));
    const unsubscribePayables = onSnapshot(qPayables, (snapshot) => {
        let total = 0;
        snapshot.forEach(doc => {
            total += (doc.data() as SupplierInvoice).total;
        });
        setTotalPayables(total);
    });

    // --- Active Work Orders Listener ---
    const qActiveWOs = query(collection(db, 'workOrders'), where('status', '==', 'Dalam Pengerjaan'));
    const unsubscribeActiveWOs = onSnapshot(qActiveWOs, (snapshot) => {
        setActiveWorkOrders(snapshot.docs.map(doc => doc.data() as WorkOrder));
    });

    // --- Recent Production Completions Listener ---
    const qRecentCompletions = query(collection(db, 'productionCompletions'), orderBy('date', 'desc'), limit(5));
    const unsubscribeRecentCompletions = onSnapshot(qRecentCompletions, (snapshot) => {
        setRecentCompletions(snapshot.docs.map(doc => ({id: doc.id, ...doc.data(), date: doc.data().date.toDate()} as ProductionCompletion)));
    });


    return () => {
      unsubscribeTransactions();
      unsubscribeLowStock();
      unsubscribeReceivables();
      unsubscribePayables();
      unsubscribeActiveWOs();
      unsubscribeRecentCompletions();
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-headline font-bold">Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/transactions">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-body">
                Penjualan Hari Ini
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {dailySales.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total pendapatan hari ini
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/sales/receivables">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-body">Total Piutang Usaha</CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                Rp {totalReceivables.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total tagihan belum lunas dari pelanggan
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/purchasing/payables">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-body">Total Utang Usaha</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                Rp {totalPayables.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total tagihan belum dibayar ke pemasok
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/production">
            <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium font-body">Produksi Berjalan</CardTitle>
                <Workflow className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{activeWorkOrders.length}</div>
                <p className="text-xs text-muted-foreground">
                    Jumlah perintah produksi yang aktif
                </p>
                </CardContent>
            </Card>
        </Link>
        <Link href="/stock/notifications">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-body">Stok Menipis</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                Produk di bawah batas minimum
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Penjualan 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <WeeklySalesChart data={weeklySales} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-headline">Stok Produk Menipis</CardTitle>
            <CardDescription>
              Produk dengan jumlah stok di bawah batas minimum.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Stok / Min.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.slice(0, 5).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {product.category}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{product.stock} / {product.minStockThreshold || 10}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
       <Card>
          <CardHeader>
            <CardTitle className="font-headline">Aktivitas Produksi Terbaru</CardTitle>
            <CardDescription>
              Menampilkan 5 penyelesaian produksi yang terakhir dicatat.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Selesai</TableHead>
                  <TableHead>Produk Jadi</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCompletions.length === 0 ? (
                   <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Belum ada aktivitas produksi.
                      </TableCell>
                   </TableRow>
                ) : (
                  recentCompletions.map((pc) => (
                      <TableRow key={pc.id}>
                      <TableCell>
                          {format(pc.date, "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell>
                          <div className="font-medium">{pc.finishedGoodName}</div>
                          <div className="text-sm text-muted-foreground font-mono text-xs">
                          WO: {pc.workOrderId}
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                          <Badge variant="secondary">{pc.quantityProduced} unit</Badge>
                      </TableCell>
                      </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
}
