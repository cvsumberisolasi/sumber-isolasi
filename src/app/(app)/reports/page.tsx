
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesReportPage from "./sales/page";
import PurchasingReportPage from "./purchasing/page";
import StockReportsPage from "./stock/page";
import ExpensesReportPage from "./expenses/page";
import FinancialReportsPage from "./financial/page";
import BalanceSheetPage from "./balance-sheet/page";
import CashFlowPage from "./cash-flow/page";
import ProductionReportPage from "./production/page";

export default function ReportsPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Laporan</h1>
            <Tabs defaultValue="sales" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="sales">Penjualan</TabsTrigger>
                    <TabsTrigger value="purchasing">Pembelian</TabsTrigger>
                    <TabsTrigger value="stock">Stok</TabsTrigger>
                    <TabsTrigger value="production">Produksi</TabsTrigger>
                    <TabsTrigger value="expenses">Beban</TabsTrigger>
                    <TabsTrigger value="profit-loss">Laba Rugi</TabsTrigger>
                    <TabsTrigger value="balance-sheet">Neraca</TabsTrigger>
                    <TabsTrigger value="cash-flow">Arus Kas</TabsTrigger>
                </TabsList>
                <TabsContent value="sales" className="mt-6">
                    <SalesReportPage />
                </TabsContent>
                <TabsContent value="purchasing" className="mt-6">
                    <PurchasingReportPage />
                </TabsContent>
                <TabsContent value="stock" className="mt-6">
                    <StockReportsPage />
                </TabsContent>
                <TabsContent value="production" className="mt-6">
                    <ProductionReportPage />
                </TabsContent>
                <TabsContent value="expenses" className="mt-6">
                    <ExpensesReportPage />
                </TabsContent>
                <TabsContent value="profit-loss" className="mt-6">
                    <FinancialReportsPage />
                </TabsContent>
                <TabsContent value="balance-sheet" className="mt-6">
                    <BalanceSheetPage />
                </TabsContent>
                <TabsContent value="cash-flow" className="mt-6">
                    <CashFlowPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
