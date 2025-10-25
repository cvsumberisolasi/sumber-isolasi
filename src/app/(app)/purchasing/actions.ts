
"use server";

import { revalidatePath } from "next/cache";
import { collection, doc, updateDoc, Timestamp, runTransaction, writeBatch, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewPurchaseOrder, NewGoodsReceipt, Product, JournalEntry, NewJournal, NewSupplierInvoice, NewPurchasePayment, NewPurchaseRequest, PurchaseRequest, PurchaseOrder, NewPurchaseReturn } from "@/lib/types";
import { addJournalEntry } from "@/app/(app)/accounting/journal/actions";
import { getAccountingSettings } from "@/app/(app)/settings/accounting/actions";
import { generateDocumentId } from "@/lib/utils";

const createResponse = (error: string | null = null, id: string | null = null) => ({ error, id });

export async function addPurchaseRequest(prData: NewPurchaseRequest) {
  try {
    const prCol = collection(db, "purchaseRequests");
    const newId = generateDocumentId('PR');
    const prWithTimestamp = { ...prData, date: Timestamp.fromDate(prData.date as Date) };
    await setDoc(doc(prCol, newId), prWithTimestamp);
    revalidatePath("/(app)/purchasing/request");
    return createResponse(null, newId);
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}

export async function updatePurchaseRequestStatus(prId: string, status: PurchaseRequest['status']) {
    try {
        const prRef = doc(db, "purchaseRequests", prId);
        await updateDoc(prRef, { status });
        revalidatePath("/(app)/purchasing/request");
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}

export async function addPurchaseOrder(poData: NewPurchaseOrder) {
  try {
    const poCol = collection(db, "purchaseOrders");
    const newId = generateDocumentId('PO');
    const poWithTimestamp = { ...poData, date: Timestamp.fromDate(poData.date as Date) };
    await setDoc(doc(poCol, newId), poWithTimestamp);
    revalidatePath("/(app)/purchasing/order");
    return createResponse(null, newId);
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}

export async function updatePurchaseOrderStatus(poId: string, status: PurchaseOrder['status']) {
    try {
        const poRef = doc(db, "purchaseOrders", poId);
        await updateDoc(poRef, { status });
        revalidatePath("/(app)/purchasing/order");
        revalidatePath("/(app)/purchasing/goods-receipt");
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}


export async function addGoodsReceipt(grData: NewGoodsReceipt, poId: string) {
    try {
        const newGRRef = await runTransaction(db, async (transaction) => {
            const grCol = collection(db, "goodsReceipts");
            const newId = generateDocumentId('GRN');
            const newDocRef = doc(grCol, newId);

            // --- 1. Perform all reads first ---
            const productReads = grData.items.map(item => {
                const productRef = doc(db, "products", item.productId);
                return transaction.get(productRef);
            });
            const productSnapshots = await Promise.all(productReads);
            
            // --- 2. Process data and prepare writes ---
            let totalValueReceived = 0;
            const productUpdates: { ref: any, newStock: number }[] = [];

            for (let i = 0; i < productSnapshots.length; i++) {
                const productSnap = productSnapshots[i];
                const item = grData.items[i];

                if (!productSnap.exists()) {
                    throw new Error(`Produk ${item.productName} tidak ditemukan.`);
                }
                const productData = productSnap.data() as Product;
                const newStock = productData.stock + item.receivedQuantity;
                totalValueReceived += (item.cost || 0) * item.receivedQuantity;
                
                productUpdates.push({ ref: productSnap.ref, newStock });
            }

            // --- 3. Perform all writes now ---
            transaction.set(newDocRef, { ...grData, date: Timestamp.fromDate(grData.date as Date), status: 'Pending Invoice' });

            productUpdates.forEach(update => {
                transaction.update(update.ref, { stock: update.newStock });
            });

            const poRef = doc(db, "purchaseOrders", poId);
            transaction.update(poRef, { status: 'Completed' });

            return { ref: newDocRef, totalValueReceived };
        });

        const { totalValueReceived } = newGRRef;
        const settings = await getAccountingSettings();
        const { inventoryAccountId, accruedPayableAccountId } = settings;

        if (!inventoryAccountId || !accruedPayableAccountId) {
            throw new Error('Akun Persediaan atau Utang Barang Diterima belum diatur di Pengaturan Akuntansi.');
        }

        const journalDescription = `Penerimaan Barang dari PO #${poId} (GRN: ${newGRRef.ref.id})`;
        const journalEntries: JournalEntry[] = [
            { accountId: inventoryAccountId, accountName: '', debit: totalValueReceived, credit: 0 },
            { accountId: accruedPayableAccountId, accountName: '', debit: 0, credit: totalValueReceived }
        ];

        const newJournal: NewJournal = {
            date: grData.date, description: journalDescription, refNumber: newGRRef.ref.id,
            entries: journalEntries, total: totalValueReceived
        };

        await addJournalEntry(newJournal);

        revalidatePath("/(app)/purchasing/goods-receipt");
        revalidatePath("/(app)/purchasing/order");
        revalidatePath("/(app)/products");
        revalidatePath("/(app)/accounting/ledger");
        revalidatePath("/(app)/dashboard");

        return createResponse(null, newGRRef.ref.id);
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}

export async function addSupplierInvoice(invoiceData: NewSupplierInvoice) {
    try {
        const batch = writeBatch(db);
        
        const invoiceCol = collection(db, "supplierInvoices");
        const newId = generateDocumentId('SINV');
        const newInvoiceRef = doc(invoiceCol, newId);
        batch.set(newInvoiceRef, { ...invoiceData, date: Timestamp.fromDate(invoiceData.date as Date), status: 'Unpaid' });

        const grRef = doc(db, "goodsReceipts", invoiceData.goodsReceiptId);
        batch.update(grRef, { status: 'Invoiced' });

        const settings = await getAccountingSettings();
        const { accruedPayableAccountId, accountsPayableAccountId, taxReceivableAccountId } = settings;
        if (!accruedPayableAccountId || !accountsPayableAccountId || !taxReceivableAccountId) {
            throw new Error('Akun Utang atau Pajak Masukan belum diatur.');
        }

        const journalDescription = `Faktur Pemasok #${invoiceData.invoiceNumber} dari ${invoiceData.supplierName}`;
        const journalEntries: JournalEntry[] = [];
        
        // Debit Utang Barang Diterima (reversing GRN journal)
        journalEntries.push({ accountId: accruedPayableAccountId, accountName: '', debit: invoiceData.subtotal, credit: 0 });

        // Debit PPN Masukan (if any)
        if (invoiceData.taxAmount && invoiceData.taxAmount > 0) {
            journalEntries.push({ accountId: taxReceivableAccountId, accountName: '', debit: invoiceData.taxAmount, credit: 0 });
        }
        
        // Credit Utang Usaha
        journalEntries.push({ accountId: accountsPayableAccountId, accountName: '', debit: 0, credit: invoiceData.grandTotal });

        const newJournal: NewJournal = {
            date: invoiceData.date, description: journalDescription, refNumber: newInvoiceRef.id,
            entries: journalEntries, total: invoiceData.grandTotal
        };
        
        const journalsCol = collection(db, "journals");
        const newJournalRef = doc(journalsCol);
        batch.set(newJournalRef, { ...newJournal, date: Timestamp.fromDate(newJournal.date as Date) });

        await batch.commit();

        revalidatePath("/(app)/purchasing/invoice");
        revalidatePath("/(app)/purchasing/payables");
        revalidatePath("/(app)/accounting/ledger");
        return createResponse(null, newInvoiceRef.id);
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}

export async function paySupplierInvoice(paymentData: NewPurchasePayment) {
    try {
        const batch = writeBatch(db);

        const paymentCol = collection(db, "purchasePayments");
        const newId = generateDocumentId('PPAY');
        const newPaymentRef = doc(paymentCol, newId);
        batch.set(newPaymentRef, { ...paymentData, date: Timestamp.fromDate(paymentData.date as Date) });

        const invoiceRef = doc(db, "supplierInvoices", paymentData.invoiceId);
        batch.update(invoiceRef, { status: 'Paid' });

        const settings = await getAccountingSettings();
        const { accountsPayableAccountId } = settings;
        if (!accountsPayableAccountId) {
            throw new Error('Akun Utang Usaha belum diatur.');
        }

        const journalDescription = `Pembayaran Faktur Pemasok #${paymentData.invoiceNumber}`;
        const journalEntries: JournalEntry[] = [
            { accountId: accountsPayableAccountId, accountName: '', debit: paymentData.amount, credit: 0 },
            { accountId: paymentData.paymentAccountId, accountName: '', debit: 0, credit: paymentData.amount }
        ];

        const newJournal: NewJournal = {
            date: paymentData.date, description: journalDescription, refNumber: newPaymentRef.id,
            entries: journalEntries, total: paymentData.amount
        };

        const journalsCol = collection(db, "journals");
        const newJournalRef = doc(journalsCol);
        batch.set(newJournalRef, { ...newJournal, date: Timestamp.fromDate(newJournal.date as Date) });
        
        await batch.commit();

        revalidatePath("/(app)/purchasing/payables");
        revalidatePath("/(app)/accounting/ledger");
        return createResponse(null, newPaymentRef.id);
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}


export async function processPurchaseReturn(returnData: NewPurchaseReturn) {
    try {
        const newReturnRef = await runTransaction(db, async (transaction) => {
            const returnsCol = collection(db, "purchaseReturns");
            const newId = generateDocumentId('PRT');
            const newDocRef = doc(returnsCol, newId);
            
            // 1. Update product stock
            for (const item of returnData.items) {
                const productRef = doc(db, "products", item.productId);
                const productSnap = await transaction.get(productRef);
                if (!productSnap.exists()) throw new Error(`Produk ${item.productName} tidak ditemukan.`);
                
                const productData = productSnap.data() as Product;
                const newStock = productData.stock - item.returnQuantity;
                
                transaction.update(productRef, { stock: newStock });
            }

            // 2. Save the return document
            transaction.set(newDocRef, { ...returnData, date: Timestamp.fromDate(returnData.date as Date) });
            return newDocRef;
        });

        // 3. Create reversing journal entry
        const settings = await getAccountingSettings();
        const { accountsPayableAccountId, inventoryAccountId } = settings;

        if (!accountsPayableAccountId || !inventoryAccountId) {
            throw new Error('Akun Utang Usaha atau Persediaan belum diatur di Pengaturan Akuntansi.');
        }

        const journalDescription = `Retur Pembelian ke ${returnData.supplierName} (Ref GRN: ${returnData.goodsReceiptId})`;
        const journalEntries: JournalEntry[] = [
            { accountId: accountsPayableAccountId, accountName: '', debit: returnData.total, credit: 0 },
            { accountId: inventoryAccountId, accountName: '', debit: 0, credit: returnData.total }
        ];

        const newJournal: NewJournal = {
            date: returnData.date,
            description: journalDescription,
            refNumber: newReturnRef.id,
            entries: journalEntries,
            total: returnData.total,
        };

        await addJournalEntry(newJournal);

        // 4. Revalidate paths
        revalidatePath("/(app)/purchasing/returns");
        revalidatePath("/(app)/products");
        revalidatePath("/(app)/accounting/ledger");
        revalidatePath("/(app)/purchasing/payables");
        revalidatePath("/(app)/reports/stock");


        return createResponse(null, newReturnRef.id);
    } catch (e) {
        console.error("Error processing purchase return: ", e);
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}
