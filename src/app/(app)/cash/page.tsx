
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CashInPage from "./in/page";
import CashOutPage from "./out/page";
import CashTransferPage from "./transfer/page";
import BankReconciliationPage from "./reconciliation/page";

export default function CashPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Kas & Bank</h1>
            <Tabs defaultValue="in">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                    <TabsTrigger value="in">Kas Masuk</TabsTrigger>
                    <TabsTrigger value="out">Kas Keluar</TabsTrigger>
                    <TabsTrigger value="transfer">Transfer Antar Kas</TabsTrigger>
                    <TabsTrigger value="reconciliation">Rekonsiliasi Bank</TabsTrigger>
                </TabsList>
                <TabsContent value="in" className="mt-6">
                    <CashInPage />
                </TabsContent>
                <TabsContent value="out" className="mt-6">
                    <CashOutPage />
                </TabsContent>
                <TabsContent value="transfer" className="mt-6">
                    <CashTransferPage />
                </TabsContent>
                <TabsContent value="reconciliation" className="mt-6">
                    <BankReconciliationPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
