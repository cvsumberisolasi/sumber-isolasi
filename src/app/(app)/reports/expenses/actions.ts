
'use server';

import { addJournalEntry } from "@/app/(app)/accounting/journal/actions";
import type { NewJournal, JournalEntry } from "@/lib/types";

interface AddExpenseJournalInput {
    date: Date;
    description: string;
    amount: number;
    debitAccountId: string;
    debitAccountName: string;
    creditAccountId: string;
    creditAccountName: string;
}

export async function addExpenseJournal(input: AddExpenseJournalInput) {
    try {
        const journalEntries: JournalEntry[] = [
            {
                accountId: input.debitAccountId,
                accountName: input.debitAccountName,
                debit: input.amount,
                credit: 0
            },
            {
                accountId: input.creditAccountId,
                accountName: input.creditAccountName,
                debit: 0,
                credit: input.amount
            }
        ];

        const newJournal: NewJournal = {
            date: input.date,
            description: input.description,
            refNumber: '',
            entries: journalEntries,
            total: input.amount,
        };

        const result = await addJournalEntry(newJournal);

        if (result.error) {
            throw new Error(result.error);
        }

        return { error: null };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'An unknown error occurred' };
    }
}
