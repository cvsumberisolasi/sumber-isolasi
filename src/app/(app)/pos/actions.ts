

"use server";

import { revalidatePath } from "next/cache";
import { 
  collection, 
  doc, 
  Timestamp,
  runTransaction,
  getDoc,
  writeBatch,
  setDoc,
  getDocs,
  query,
  where,
  type WriteBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewTransaction, Product, JournalEntry, NewJournal, NewParkedTransaction, NewSalesReturn, Transaction, Tax } from "@/lib/types";
import { addJournalEntry } from "../accounting/journal/actions";
import { getAccountingSettings } from "../settings/accounting/actions";
import { generateDocumentId } from "@/lib/utils";

// Helper function to return a consistent response shape
const createResponse = (error: string | null = null, id: string | null = null) => ({ error, id });

export async function parkTransaction(parkedData: NewParkedTransaction) {
    try {
        const id = generateDocumentId('PARK');
        const parkedCol = collection(db, 'parkedTransactions');
        await setDoc(doc(parkedCol, id), {
            ...parkedData,
            createdAt: Timestamp.fromDate(parkedData.createdAt as Date)
        });
        revalidatePath('/(app)/pos/parked');
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}

export async function getTransaction(id: string) {
    try {
        const txRef = doc(db, 'transactions', id);
        const txSnap = await getDoc(txRef);
        if (!txSnap.exists()) {
            return { data: null, error: "Transaksi tidak ditemukan." };
        }
        const txData = txSnap.data();
        const transaction: Transaction = {
            id: txSnap.id,
            ...txData,
            date: txData.date.toDate(),
        } as Transaction;
        return { data: transaction, error: null };
    } catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'An unknown error occurred.' };
    }
}

export async function createTransaction(transactionData: NewTransaction, isPOS: boolean = true) {
  try {
    const newTransactionRef = await runTransaction(db, async (t) => {
        const productsCol = collection(db, 'products');
        const transactionsCol = collection(db, "transactions");

        const newId = generateDocumentId('INV');
        const newDocRef = doc(transactionsCol, newId);

        let totalCost = 0;

        // --- 1. Perform all reads first ---
        const productReads = transactionData.items.map(item => {
            const productRef = doc(productsCol, item.productId);
            return t.get(productRef);
        });
        const productSnaps = await Promise.all(productReads);

        // --- 2. Perform all writes now ---
        for (let i = 0; i < productSnaps.length; i++) {
            const productSnap = productSnaps[i];
            const item = transactionData.items[i];
            
            if (!productSnap.exists()) {
                throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
            }
            const productData = productSnap.data() as Product;
            const newStock = productData.stock - item.quantity;
            
            totalCost += (productData.cost || 0) * item.quantity;
            
            // This is the write operation
            t.update(productSnap.ref, { stock: newStock });
        }
        
        const status = transactionData.paymentMethod === 'Kredit' ? 'Belum Lunas' : 'Lunas';
        
        const transactionToSave = {
          ...transactionData,
          date: Timestamp.fromDate(transactionData.date as Date),
          status,
        };

        t.set(newDocRef, transactionToSave);
        
        return { ref: newDocRef, totalCost };
    });

    const { totalCost } = newTransactionRef;
    const { subtotal, taxAmount, grandTotal, paymentMethod, netTotal } = transactionData;
    const description = `Penjualan ${isPOS ? 'POS' : 'Manual'} #${newTransactionRef.ref.id}`;

    const settings = await getAccountingSettings();
    
    let paymentAccountId: string | undefined;
    if (paymentMethod === 'Tunai') {
        paymentAccountId = settings.cashAccountId;
    } else if (paymentMethod === 'Transfer') {
        paymentAccountId = settings.bankAccountId;
    } else if (paymentMethod === 'Kredit') {
        paymentAccountId = settings.accountsReceivableAccountId;
    }

    const requiredAccountIds = [
      paymentAccountId,
      settings.salesRevenueAccountId,
      settings.cogsAccountId,
      settings.inventoryAccountId,
      taxAmount && taxAmount > 0 ? settings.taxPayableAccountId : 'dummy' // only require tax account if tax is applied
    ];

    if (requiredAccountIds.some(id => !id)) {
       throw new Error(`Gagal membuat jurnal otomatis: Pengaturan pemetaan akun belum lengkap. Mohon lengkapi di menu Pengaturan > Akuntansi.`);
    }

    const journalEntries: JournalEntry[] = [];
    
    const finalTotal = netTotal ?? grandTotal;

    journalEntries.push(
        { accountId: paymentAccountId!, accountName: '', debit: finalTotal, credit: 0 },
        { accountId: settings.salesRevenueAccountId!, accountName: '', debit: 0, credit: subtotal }
    );
    if(taxAmount && taxAmount > 0 && settings.taxPayableAccountId) {
        journalEntries.push({ accountId: settings.taxPayableAccountId, accountName: '', debit: 0, credit: taxAmount });
    }
    
    if (totalCost > 0) {
        const cogsJournal: NewJournal = {
            date: transactionData.date,
            description: `HPP untuk ${description}`,
            refNumber: newTransactionRef.ref.id,
            entries: [
                { accountId: settings.cogsAccountId!, accountName: '', debit: totalCost, credit: 0 },
                { accountId: settings.inventoryAccountId!, accountName: '', debit: 0, credit: totalCost }
            ],
            total: totalCost, 
        };
        await addJournalEntry(cogsJournal);
    }
    
    const newJournal: NewJournal = {
      date: transactionData.date,
      description,
      refNumber: newTransactionRef.ref.id,
      entries: journalEntries,
      total: finalTotal, 
    };

    await addJournalEntry(newJournal);

    revalidatePath("/(app)/pos");
    revalidatePath("/(app)/transactions");
    revalidatePath("/(app)/dashboard");
    revalidatePath("/(app)/accounting/ledger");
    revalidatePath("/(app)/sales/receivables");
    revalidatePath("/(app)/sales/manual-input");
    return createResponse(null, newTransactionRef.ref.id);
  } catch (e) {
    console.error("Error adding transaction: ", e);
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}

export async function processSalesReturn(returnData: NewSalesReturn) {
  try {
    const returnRef = await runTransaction(db, async (t) => {
        const returnsCol = collection(db, 'salesReturns');
        const newReturnId = generateDocumentId('SR'); // SR for Sales Return
        const newReturnRef = doc(returnsCol, newReturnId);

        let totalCost = 0;
        
        // --- 1. Perform all reads first ---
        const originalTxRef = doc(db, 'transactions', returnData.originalTransactionId);
        const originalTxSnap = await t.get(originalTxRef);

        const productReads = returnData.items.map(item => t.get(doc(db, 'products', item.productId)));
        const productSnaps = await Promise.all(productReads);
        
        // --- 2. Perform all writes now ---
        for(let i = 0; i < productSnaps.length; i++) {
            const productSnap = productSnaps[i];
            const item = returnData.items[i];
            
            if (!productSnap.exists()) {
                throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
            }
            const productData = productSnap.data() as Product;
            totalCost += (productData.cost || 0) * item.quantity;
            
            const newStock = productData.stock + item.quantity;
            t.update(productSnap.ref, { stock: newStock });
        }
        
        if (originalTxSnap.exists()) {
            const originalTxData = originalTxSnap.data() as Transaction;
            if (originalTxData.status === 'Belum Lunas') {
                const newGrandTotal = (originalTxData.grandTotal || originalTxData.total) - returnData.total;
                t.update(originalTxRef, { grandTotal: newGrandTotal, total: newGrandTotal });
            }
        }
        
        const returnWithTimestamp = {
          ...returnData,
          date: Timestamp.fromDate(new Date()),
        };
        t.set(newReturnRef, returnWithTimestamp);
        
        return { ref: newReturnRef, totalCost };
    });

    // Create reversing journal entry
    const { totalCost } = returnRef;
    const { total, originalPaymentMethod, originalTransactionId } = returnData;
    const description = `Retur Penjualan dari Transaksi #${originalTransactionId}`;

    const settings = await getAccountingSettings();
    let paymentAccountId;
    if (originalPaymentMethod === 'Tunai') {
        paymentAccountId = settings.cashAccountId;
    } else if (originalPaymentMethod === 'Transfer') {
        paymentAccountId = settings.bankAccountId;
    } else {
        paymentAccountId = settings.accountsReceivableAccountId;
    }
    
    const requiredAccountIds = [
      paymentAccountId,
      settings.salesRevenueAccountId,
      settings.cogsAccountId,
      settings.inventoryAccountId
    ];

    if (requiredAccountIds.some(id => !id)) {
       throw new Error(`Gagal membuat jurnal otomatis: Pengaturan pemetaan akun belum lengkap.`);
    }

    const journalEntries: JournalEntry[] = [];

    // Reverse revenue
    journalEntries.push(
        { accountId: settings.salesRevenueAccountId!, accountName: '', debit: total, credit: 0 },
        { accountId: paymentAccountId!, accountName: '', debit: 0, credit: total }
    );
    
    const newJournal: NewJournal = {
      date: new Date(),
      description,
      refNumber: returnRef.ref.id,
      entries: journalEntries,
      total: total,
    };
    await addJournalEntry(newJournal);

    // Reverse COGS
    if (totalCost > 0) {
       const cogsReversalJournal: NewJournal = {
         date: new Date(),
         description: `Pembalikan HPP untuk Retur #${returnRef.ref.id}`,
         refNumber: returnRef.ref.id,
         entries: [
            { accountId: settings.inventoryAccountId!, accountName: '', debit: totalCost, credit: 0 },
            { accountId: settings.cogsAccountId!, accountName: '', debit: 0, credit: totalCost }
         ],
         total: totalCost,
       };
       await addJournalEntry(cogsReversalJournal);
    }
    
    revalidatePath('/(app)/pos/returns');
    revalidatePath('/(app)/sales/returns');
    revalidatePath('/(app)/dashboard');
    revalidatePath('/(app)/accounting/ledger');
    revalidatePath('/(app)/sales/receivables');

    return createResponse(null, returnRef.ref.id);
  } catch (e) {
    console.error("Error processing sales return: ", e);
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}


export async function settleReceivable(transactionId: string, paymentAccountId: string, batch?: WriteBatch) {
    const settings = await getAccountingSettings();
    if (!settings.accountsReceivableAccountId) {
        throw new Error("Akun Piutang Usaha belum diatur di Pengaturan Akuntansi.");
    }
    
    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) {
        throw new Error(`Transaksi dengan ID ${transactionId} tidak ditemukan.`);
    }
    const transaction = txSnap.data() as Transaction;
    
    const localBatch = batch || writeBatch(db);

    localBatch.update(txRef, { status: 'Lunas' });
    
    const totalToSettle = transaction.grandTotal || transaction.total;

    const description = `Pelunasan piutang untuk transaksi #${transactionId}`;
    const journalEntries: JournalEntry[] = [
        { accountId: paymentAccountId, accountName: '', debit: totalToSettle, credit: 0 },
        { accountId: settings.accountsReceivableAccountId, accountName: '', debit: 0, credit: totalToSettle },
    ];
    
    const newJournal: NewJournal = {
        date: new Date(),
        description,
        refNumber: `PEL-${transactionId}`,
        entries: journalEntries,
        total: totalToSettle,
    };

    const journalsCol = collection(db, "journals");
    const newJournalRef = doc(journalsCol);
    
    localBatch.set(newJournalRef, { ...newJournal, date: Timestamp.fromDate(newJournal.date as Date) });

    if (!batch) {
        await localBatch.commit();
        revalidatePath('/(app)/sales/receivables');
        revalidatePath('/(app)/accounting/ledger');
    }
}


export async function settleMultipleReceivables(transactionIds: string[], paymentAccountId: string) {
    try {
        const batch = writeBatch(db);
        for (const txId of transactionIds) {
            await settleReceivable(txId, paymentAccountId, batch);
        }
        await batch.commit();

        revalidatePath('/(app)/sales/receivables');
        revalidatePath('/(app)/accounting/ledger');

        return createResponse();
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}
    
