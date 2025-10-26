
'use client';

import type { Account } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoaActions } from '@/components/accounting/coa-actions';
import { CoaTable } from '@/components/accounting/coa-table';

type AccountWithBalance = Account & { balance: number };

export default function ChartOfAccountsPage({ accounts }: { accounts: AccountWithBalance[] }) {
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
