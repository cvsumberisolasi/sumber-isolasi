
import type { Journal, Account } from './types';

export const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export type ExpenseCategory = 'Beban Pokok Penjualan' | 'Beban Operasional' | 'Beban Lainnya';

export const getExpenseCategory = (accountType: string): ExpenseCategory | null => {
  if (accountType === 'Beban Pokok Penjualan') return 'Beban Pokok Penjualan';
  if (accountType === 'Beban Operasional') return 'Beban Operasional';
  if (accountType === 'Beban Lainnya') return 'Beban Lainnya';
  return null;
};

export const groupExpenses = (journals: Journal[], accounts: Account[]) => {
  const expenseAccountTypes = ['Beban Pokok Penjualan', 'Beban Operasional', 'Beban Lainnya'];
  const expenseAccounts = accounts.filter(acc => expenseAccountTypes.includes(acc.type));
  
  const balances: { [accountId: string]: number } = {};
  expenseAccounts.forEach(acc => { balances[acc.id] = 0; });

  journals.forEach(journal => {
    journal.entries.forEach(entry => {
      if (balances[entry.accountId] !== undefined) {
        balances[entry.accountId] += entry.debit - entry.credit;
      }
    });
  });

  const expensesByAccount = expenseAccounts.map(account => {
    const category = getExpenseCategory(account.type);
    return {
      accountId: account.id,
      accountName: account.name,
      category: category as ExpenseCategory,
      amount: balances[account.id] || 0,
    };
  }).filter(e => e.amount !== 0);

  const expensesByCategory = Object.values(expensesByAccount.reduce((acc, current) => {
    if (!acc[current.category]) {
      acc[current.category] = { category: current.category, amount: 0 };
    }
    acc[current.category].amount += current.amount;
    return acc;
  }, {} as { [key: string]: { category: ExpenseCategory, amount: number } }));
  
  const totalExpenses = expensesByCategory.reduce((sum, cat) => sum + cat.amount, 0);

  return { expensesByCategory, totalExpenses, expensesByAccount };
};
