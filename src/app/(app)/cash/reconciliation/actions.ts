
'use server';

import { addJournalEntry } from '@/app/(app)/accounting/journal/actions';
import type { Account, NewJournal, JournalEntry } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const createResponse = (error: string | null = null) => ({ error });

/**
 * Creates an adjustment journal entry from the bank reconciliation page.
 * @param date - The date of the transaction.
 * @param description - The description for the journal entry.
 * @param amount - The transaction amount. If positive, it's a debit to cash; if negative, a credit.
 * @param cashAccountId - The ID of the cash/bank account being reconciled.
 * @param contraAccountId - The ID of the opposing account (e.g., Bank Fees, Interest Income).
 */
export async function createAdjustmentJournal(
  date: Date,
  description: string,
  amount: number,
  cashAccountId: string,
  contraAccountId: string
) {
  try {
    if (!cashAccountId || !contraAccountId) {
      throw new Error('Akun kas dan akun lawan harus dipilih.');
    }

    const journalEntries: JournalEntry[] = [];

    if (amount > 0) {
      // Pemasukan (misal: pendapatan bunga)
      // Debit Kas, Kredit Akun Lawan (Pendapatan)
      journalEntries.push({ accountId: cashAccountId, accountName: '', debit: amount, credit: 0 });
      journalEntries.push({ accountId: contraAccountId, accountName: '', debit: 0, credit: amount });
    } else {
      // Pengeluaran (misal: biaya admin)
      // Debit Akun Lawan (Beban), Kredit Kas
      const absAmount = Math.abs(amount);
      journalEntries.push({ accountId: contraAccountId, accountName: '', debit: absAmount, credit: 0 });
      journalEntries.push({ accountId: cashAccountId, accountName: '', debit: 0, credit: absAmount });
    }

    const newJournal: NewJournal = {
      date,
      description: `Penyesuaian Rekonsiliasi: ${description}`,
      refNumber: `RECON-${date.getTime()}`,
      entries: journalEntries,
      total: Math.abs(amount),
    };

    const result = await addJournalEntry(newJournal);

    if (result.error) {
        throw new Error(result.error);
    }
    
    revalidatePath('/(app)/cash/reconciliation');
    return createResponse();
  } catch (e) {
    console.error('Error creating adjustment journal:', e);
    return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
  }
}
