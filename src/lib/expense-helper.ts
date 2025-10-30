
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
        // Corrected logic: Expenses increase with debits, so their value is negative from a balance perspective.
        // However, for display as a cost, we want a positive number. But user wants negative.
        // Let's keep it consistent: debit is positive for expense accounts.
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
      // Make the amount negative for display consistency
      amount: -(balances[account.id] || 0),
    };
  }).filter(e => e.amount !== 0); // Show both positive (credit adjustments) and negative values

  const expensesByCategory = Object.values(expensesByAccount.reduce((acc, current) => {
    if (!acc[current.category]) {
      acc[current.category] = { category: current.category, amount: 0 };
    }
    // Use Math.abs because for the chart we need positive values
    acc[current.category].amount += Math.abs(current.amount);
    return acc;
  }, {} as { [key: string]: { category: ExpenseCategory, amount: number } }));
  
  const totalExpenses = expensesByCategory.reduce((sum, cat) => sum + cat.amount, 0);

  return { expensesByCategory, totalExpenses, expensesByAccount };
};
