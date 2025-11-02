
"use server";

import { collection, query, where, Timestamp, getDocs, writeBatch, doc, getDoc, addDoc, deleteDoc, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAccountingSettings } from "@/app/(app)/settings/accounting/actions";
import { addJournalEntry } from "@/app/(app)/accounting/journal/actions";
import type { JournalEntry, NewJournal, Account, Journal } from "@/lib/types";
import { revalidatePath } from "next/cache";

const createResponse = (error: string | null = null, extraMessage: string | null = null) => ({ error, extraMessage });

async function createReversingEntries(year: number, month: number, batch: WriteBatch): Promise<{ id: string | null, message: string | null }> {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    
    const reversingDate = new Date(nextYear, nextMonth - 1, 1);
    const periodStartDate = new Date(year, month - 1, 1);
    const periodEndDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    const journalsCol = collection(db, "journals");
    const journalsQuery = query(
        journalsCol,
        where("date", ">=", Timestamp.fromDate(periodStartDate)),
        where("date", "<=", Timestamp.fromDate(periodEndDate)),
        where("description", "==", "Jurnal Penyesuaian") // Target adjustments specifically
    );
    const journalsSnapshot = await getDocs(journalsQuery);

    if (journalsSnapshot.empty) return { id: null, message: null };
    
    const reversingJournalEntries: JournalEntry[] = [];
    let total = 0;

    for (const journalDoc of journalsSnapshot.docs) {
        const journal = journalDoc.data() as Journal;
        journal.entries.forEach(entry => {
            reversingJournalEntries.push({
                accountId: entry.accountId,
                accountName: entry.accountName,
                debit: entry.credit,
                credit: entry.debit
            });
        });
        total += journal.total;
    }

    if (reversingJournalEntries.length > 0) {
        const newReversingJournalRef = doc(journalsCol);
        const reversingJournal: NewJournal = {
            date: reversingDate,
            description: `Jurnal Pembalik untuk Periode ${getMonthName(month)} ${year}`,
            refNumber: `JPB-${year}-${month}`,
            entries: reversingJournalEntries,
            total: total,
        };
        batch.set(newReversingJournalRef, {...reversingJournal, date: Timestamp.fromDate(reversingDate) });
        return { 
            id: newReversingJournalRef.id,
            message: `Jurnal pembalik untuk ${getMonthName(month)} ${year} berhasil dibuat.`
        };
    }

    return { id: null, message: null };
}


export async function performPeriodClosing({ year, month }: { year: number, month: number }) {
    const settings = await getAccountingSettings();
    const { incomeSummaryAccountId, retainedEarningsAccountId } = settings;

    if (!incomeSummaryAccountId || !retainedEarningsAccountId) {
        return createResponse("Akun Ikhtisar Laba Rugi atau Laba Ditahan belum diatur di Pengaturan Akuntansi.");
    }
    
    // Check if period is in the future
    const today = new Date();
    const closingPeriodDate = new Date(year, month - 1, 1);
    if (closingPeriodDate > today) {
        return createResponse("Tidak dapat melakukan tutup buku untuk periode di masa depan.");
    }

    // Check if period is already closed
    const closingHistoryQuery = query(collection(db, 'periodClosings'), where('year', '==', year), where('month', '==', month));
    const historySnapshot = await getDocs(closingHistoryQuery);
    if (!historySnapshot.empty) {
        return createResponse(`Periode ${getMonthName(month)} ${year} sudah ditutup sebelumnya.`);
    }

    const batch = writeBatch(db);
    const journalsCol = collection(db, 'journals');
    const closingJournalIds: string[] = [];

    try {
        const accountTypesToClose = ['Pendapatan', 'Pendapatan Lainnya', 'Beban Pokok Penjualan', 'Beban Operasional', 'Beban Lainnya'];
        const accountsCol = collection(db, "coa");
        const accountsQuery = query(accountsCol, where("type", "in", accountTypesToClose));
        const accountsSnapshot = await getDocs(accountsQuery);
        const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));

        if (accounts.length === 0) {
            return createResponse("Tidak ada akun pendapatan atau beban yang ditemukan untuk ditutup.");
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        
        const journalsQuery = query(journalsCol, where("date", ">=", Timestamp.fromDate(startDate)), where("date", "<=", Timestamp.fromDate(endDate)));
        const journalsSnapshot = await getDocs(journalsQuery);
        
        const accountBalances: { [accountId: string]: number } = {};
        accounts.forEach(acc => accountBalances[acc.id] = 0);

        journalsSnapshot.docs.forEach(doc => {
            const journal = doc.data();
            journal.entries.forEach((entry: JournalEntry) => {
                if (accountBalances[entry.accountId] !== undefined) {
                     accountBalances[entry.accountId] += (accountIsDebitNormal(accounts.find(a => a.id === entry.accountId)?.type) ? entry.debit - entry.credit : entry.credit - entry.debit);
                }
            });
        });

        const closingDate = new Date(year, month, 0, 23, 59, 58);
        const closingEntries1: JournalEntry[] = [];
        let totalRevenue = 0;
        let totalExpenses = 0;

        accounts.forEach(account => {
            const balance = accountBalances[account.id] || 0;
            if (balance === 0) return;

            const isRevenueType = account.type.includes('Pendapatan');

            if (isRevenueType) {
                closingEntries1.push({ accountId: account.id, accountName: account.name, debit: balance, credit: 0 });
                totalRevenue += balance;
            } else { 
                closingEntries1.push({ accountId: account.id, accountName: account.name, debit: 0, credit: balance });
                totalExpenses += balance;
            }
        });
        
        if (closingEntries1.length === 0) {
            return createResponse(`Tidak ada saldo pada akun pendapatan/beban untuk periode ${getMonthName(month)} ${year}.`);
        }

        const netIncome = totalRevenue - totalExpenses;

        closingEntries1.push({
            accountId: incomeSummaryAccountId,
            accountName: 'Ikhtisar Laba Rugi',
            debit: netIncome < 0 ? -netIncome : 0,
            credit: netIncome > 0 ? netIncome : 0
        });
        
        const newClosingJournal1Ref = doc(journalsCol);
        const closingJournal1: NewJournal = {
            date: closingDate,
            description: `Jurnal Penutup Pendapatan & Beban - ${getMonthName(month)} ${year}`,
            refNumber: `JNP-1-${year}-${month}`,
            entries: closingEntries1,
            total: totalRevenue > totalExpenses ? totalRevenue : totalExpenses,
        };
        batch.set(newClosingJournal1Ref, {...closingJournal1, date: Timestamp.fromDate(closingDate)});
        closingJournalIds.push(newClosingJournal1Ref.id);

        if (netIncome !== 0) {
            const newClosingJournal2Ref = doc(journalsCol);
            const closingJournal2: NewJournal = {
                date: new Date(closingDate.getTime() + 1000),
                description: `Jurnal Penutup Ikhtisar L/R ke Laba Ditahan - ${getMonthName(month)} ${year}`,
                refNumber: `JNP-2-${year}-${month}`,
                entries: [
                    { accountId: incomeSummaryAccountId, accountName: 'Ikhtisar Laba Rugi', debit: netIncome > 0 ? netIncome : 0, credit: netIncome < 0 ? -netIncome : 0 },
                    { accountId: retainedEarningsAccountId, accountName: 'Laba Ditahan', debit: netIncome < 0 ? -netIncome : 0, credit: netIncome > 0 ? netIncome : 0 },
                ],
                total: Math.abs(netIncome),
            }
            batch.set(newClosingJournal2Ref, {...closingJournal2, date: Timestamp.fromDate(new Date(closingDate.getTime() + 1000))});
            closingJournalIds.push(newClosingJournal2Ref.id);
        }
        
        const { id: reversingJournalId, message: reversingMessage } = await createReversingEntries(year, month, batch);
        
        const closingHistoryRef = doc(collection(db, 'periodClosings'));
        batch.set(closingHistoryRef, {
            year, month,
            closedAt: Timestamp.now(),
            closingJournalIds,
            ...(reversingJournalId && { reversingJournalId }),
        });

        await batch.commit();

        revalidatePath("/(app)/accounting/closing");
        revalidatePath("/(app)/accounting/ledger");
        revalidatePath("/(app)/reports/financial");

        return createResponse(null, reversingMessage);

    } catch (e) {
        console.error("Error performing period closing: ", e);
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}


export async function deletePeriodClosing(id: string) {
    try {
        const closingDocRef = doc(db, 'periodClosings', id);
        const closingDocSnap = await getDoc(closingDocRef);
        
        if (!closingDocSnap.exists()) {
            throw new Error("Catatan tutup buku tidak ditemukan.");
        }

        const closingData = closingDocSnap.data();
        const batch = writeBatch(db);

        // Delete associated journals
        if (closingData.closingJournalIds && Array.isArray(closingData.closingJournalIds)) {
            closingData.closingJournalIds.forEach((journalId: string) => {
                batch.delete(doc(db, 'journals', journalId));
            });
        }
        if (closingData.reversingJournalId) {
            batch.delete(doc(db, 'journals', closingData.reversingJournalId));
        }

        // Delete the closing record itself
        batch.delete(closingDocRef);

        await batch.commit();
        
        revalidatePath("/(app)/accounting/closing");
        return createResponse();

    } catch(e) {
        console.error("Error deleting period closing:", e);
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}


const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleString('id-ID', { month: 'long' });
}
const accountIsDebitNormal = (type: string = '') => {
    return type.includes('Aset') || type.includes('Beban');
}

    

    


