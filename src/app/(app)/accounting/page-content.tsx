
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralJournalPage from "./journal/page";
import GeneralLedgerPage from "./ledger/page";
import PeriodClosingPage from "./closing/page";
import PostClosingTrialBalancePage from "./post-closing-trial-balance/page";
import type { Account } from "@/lib/types";
import { CoaActions } from "@/components/accounting/coa-actions";
import { CoaTable } from "@/components/accounting/coa-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AccountWithBalance = Account & { balance: number };

function ChartOfAccountsPage({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-headline font-bold">
          Bagan Akun (Chart of Accounts)
        </h2>
        <div className="w-full sm:w-auto">
         <CoaActions hasAccounts={accounts.length > 0} />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Daftar Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <CoaTable data={accounts} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export default function AccountingPageContent({ accounts }: { accounts: AccountWithBalance[] }) {
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
                    <ChartOfAccountsPage accounts={accounts} />
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
