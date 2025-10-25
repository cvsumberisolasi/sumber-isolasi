
import { db } from '@/lib/firebase';
import type { Account } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoaActions } from '@/components/accounting/coa-actions';
import { CoaTable } from '@/components/accounting/coa-table';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

async function getAccounts(): Promise<Account[]> {
  const accountsCol = collection(db, 'coa');
  const accountSnapshot = await getDocs(query(accountsCol, orderBy('code')));
  const accountList = accountSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      code: data.code,
      name: data.name,
      type: data.type,
    } as Account;
  });
  return accountList;
}

export default async function ChartOfAccountsPage() {
  const accounts = await getAccounts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-headline font-bold">
          Bagan Akun (Chart of Accounts)
        </h1>
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
