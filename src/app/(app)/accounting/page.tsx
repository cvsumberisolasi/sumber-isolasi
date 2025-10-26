
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChartOfAccountsPage from "./coa/page";
import GeneralJournalPage from "./journal/page";
import GeneralLedgerPage from "./ledger/page";
import PeriodClosingPage from "./closing/page";
import PostClosingTrialBalancePage from "./post-closing-trial-balance/page";

export default function AccountingPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Akuntansi</h1>
            <Tabs defaultValue="coa">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="coa">Bagan Akun (COA)</TabsTrigger>
                    <TabsTrigger value="journal">Jurnal Umum</TabsTrigger>
                    <TabsTrigger value="ledger">Buku Besar</TabsTrigger>
                    <TabsTrigger value="closing">Tutup Buku</TabsTrigger>
                    <TabsTrigger value="post-closing-trial-balance">Neraca Saldo Penutupan</TabsTrigger>
                </TabsList>
                <TabsContent value="coa" className="mt-6">
                    <ChartOfAccountsPage />
                </TabsContent>
                <TabsContent value="journal" className="mt-6">
                    <GeneralJournalPage />
                </TabsContent>
                <TabsContent value="ledger" className="mt-6">
                    <GeneralLedgerPage />
                </TabsContent>
                <TabsContent value="closing" className="mt-6">
                    <PeriodClosingPage />
                </TabsContent>
                 <TabsContent value="post-closing-trial-balance" className="mt-6">
                    <PostClosingTrialBalancePage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
