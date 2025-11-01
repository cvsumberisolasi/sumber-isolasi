
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TransactionsPage from "../transactions/page";
import ManualSalesInputPage from "./manual-input/page";
import AccountsReceivablePage from "./receivables/page";
import SalesReturnsPage from "./returns/page";
import ImportMarketplacePage from "./import/page";
import ImportMappingHistoryPage from "./import/history/page";

export default function SalesPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Penjualan</h1>
            <Tabs defaultValue="history">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="history">Riwayat Penjualan</TabsTrigger>
                    <TabsTrigger value="manual-input">Buat Invoice</TabsTrigger>
                    <TabsTrigger value="receivables">Piutang Usaha</TabsTrigger>
                    <TabsTrigger value="returns">Retur Penjualan</TabsTrigger>
                    <TabsTrigger value="import">Import Marketplace</TabsTrigger>
                    <TabsTrigger value="import-mapping">Riwayat Mapping</TabsTrigger>
                </TabsList>
                <TabsContent value="history" className="mt-6">
                    <TransactionsPage />
                </TabsContent>
                <TabsContent value="manual-input" className="mt-6">
                    <ManualSalesInputPage />
                </TabsContent>
                <TabsContent value="receivables" className="mt-6">
                    <AccountsReceivablePage />
                </TabsContent>
                <TabsContent value="returns" className="mt-6">
                    <SalesReturnsPage />
                </TabsContent>
                 <TabsContent value="import" className="mt-6">
                    <ImportMarketplacePage />
                </TabsContent>
                 <TabsContent value="import-mapping" className="mt-6">
                    <ImportMappingHistoryPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
