
import { db } from '@/lib/firebase';
import type { Account } from '@/lib/types';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import AccountingPageContent from './page-content';

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


export default async function AccountingPage() {
    const accounts = await getAccounts();

    return <AccountingPageContent accounts={accounts} />
}
