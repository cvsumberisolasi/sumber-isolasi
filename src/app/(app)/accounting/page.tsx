
import { db } from '@/lib/firebase';
import type { Account, Journal } from '@/lib/types';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import AccountingPageContent from './page-content';

type AccountWithBalance = Account & { balance: number };

async function getAccounts(): Promise<AccountWithBalance[]> {
  const accountsCol = collection(db, 'coa');
  const journalsCol = collection(db, 'journals');

  const [accountSnapshot, journalSnapshot] = await Promise.all([
    getDocs(query(accountsCol, orderBy('code'))),
    getDocs(query(journalsCol))
  ]);
  
  const accountList = accountSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      code: data.code,
      name: data.name,
      type: data.type,
    } as Account;
  });

  const journalList = journalSnapshot.docs.map(doc => doc.data() as Journal);
  
  const balances: Record<string, number> = {};
  accountList.forEach(acc => balances[acc.id] = 0);

  journalList.forEach(journal => {
    journal.entries.forEach(entry => {
        if (balances[entry.accountId] !== undefined) {
            const account = accountList.find(a => a.id === entry.accountId);
            if (!account) return;

            const isDebitNormal = account.type.startsWith('Aset') || account.type.startsWith('Beban');
            const isContraAsset = account.type.startsWith('Akumulasi');

            let balanceEffect = isDebitNormal ? entry.debit - entry.credit : entry.credit - entry.debit;
            if (isContraAsset) {
                balanceEffect = -balanceEffect;
            }
            
            balances[entry.accountId] += balanceEffect;
        }
    });
  });

  return accountList.map(acc => ({
      ...acc,
      balance: balances[acc.id] || 0
  }));
}


export default async function AccountingPage() {
    const accounts = await getAccounts();

    return <AccountingPageContent accounts={accounts} />
}
