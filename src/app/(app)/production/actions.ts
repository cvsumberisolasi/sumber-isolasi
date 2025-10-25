
'use server';

import { revalidatePath } from "next/cache";
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, Timestamp, runTransaction, getDoc, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewBillOfMaterial, NewWorkOrder, WorkOrder, Product, BillOfMaterial, NewJournal, JournalEntry, ProductionCompletion, NewProductionCompletion } from "@/lib/types";
import { generateDocumentId } from "@/lib/utils";
import { addJournalEntry } from "../accounting/journal/actions";
import { getAccountingSettings } from "../settings/accounting/actions";

const createResponse = (error: string | null = null, id: string | null = null) => ({ error, id });

// --- Bill of Material Actions ---
export async function addBillOfMaterial(data: NewBillOfMaterial) {
  try {
    await addDoc(collection(db, 'billOfMaterials'), data);
    revalidatePath("/(app)/production/bom");
    return createResponse();
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
  }
}

export async function updateBillOfMaterial(id: string, data: Partial<NewBillOfMaterial>) {
  try {
    await updateDoc(doc(db, 'billOfMaterials', id), data);
    revalidatePath("/(app)/production/bom");
    return createResponse();
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
  }
}

export async function deleteBillOfMaterial(id: string) {
  try {
    await deleteDoc(doc(db, 'billOfMaterials', id));
    revalidatePath("/(app)/production/bom");
    return createResponse();
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
  }
}

// --- Work Order Actions ---
export async function addWorkOrder(data: NewWorkOrder) {
    try {
        const id = generateDocumentId('WO');
        const woRef = doc(db, 'workOrders', id);
        
        const dataWithTimestamps = {
            ...data,
            date: Timestamp.fromDate(data.date as Date),
            startDate: Timestamp.fromDate(data.startDate as Date),
            endDate: Timestamp.fromDate(data.endDate as Date),
        };

        await setDoc(woRef, dataWithTimestamps);
        revalidatePath('/(app)/production/work-order');
        return createResponse(null, id);
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}

export async function updateWorkOrderStatus(id: string, status: WorkOrder['status']) {
    try {
        const woRef = doc(db, 'workOrders', id);
        await updateDoc(woRef, { status });
        revalidatePath('/(app)/production/work-order');
        revalidatePath('/(app)/production/worksheet');
        return createResponse();
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}

// --- Production Completion Actions ---
export async function completeProduction(completionData: NewProductionCompletion) {
    try {
        const newCompletionRef = await runTransaction(db, async (transaction) => {
            const completionCol = collection(db, "productionCompletions");
            const newId = generateDocumentId('PC');
            const newDocRef = doc(completionCol, newId);

            // --- Phase 1: All Reads ---
            const rawMaterialReads = completionData.consumedItems.map(item => 
                transaction.get(doc(db, 'products', item.productId))
            );
            const finishedGoodRead = transaction.get(doc(db, 'products', completionData.finishedGoodId));

            const [finishedGoodSnap, ...rawMaterialSnaps] = await Promise.all([finishedGoodRead, ...rawMaterialReads]);

            if (!finishedGoodSnap.exists()) {
                throw new Error(`Barang jadi ${completionData.finishedGoodName} tidak ditemukan.`);
            }

            // --- Phase 2: Logic & Validation (No DB Writes Yet) ---
            const updates: { ref: FirebaseFirestore.DocumentReference<DocumentData>, newStock: number }[] = [];

            for (let i = 0; i < completionData.consumedItems.length; i++) {
                const item = completionData.consumedItems[i];
                const productSnap = rawMaterialSnaps[i];

                if (!productSnap.exists()) {
                    throw new Error(`Bahan baku ${item.productName} tidak ditemukan.`);
                }
                const productData = productSnap.data() as Product;
                const newStock = productData.stock - item.quantity;
                if (newStock < 0) {
                    throw new Error(`Stok ${item.productName} tidak mencukupi.`);
                }
                updates.push({ ref: productSnap.ref, newStock });
            }
            
            const finishedGoodData = finishedGoodSnap.data() as Product;
            const newFinishedGoodStock = finishedGoodData.stock + completionData.quantityProduced;
            updates.push({ ref: finishedGoodSnap.ref, newStock: newFinishedGoodStock });
            
            // --- Phase 3: All Writes ---
            for (const update of updates) {
                transaction.update(update.ref, { stock: update.newStock });
            }

            const woRef = doc(db, 'workOrders', completionData.workOrderId);
            transaction.update(woRef, { status: 'Selesai' });

            const dataWithTimestamp = {
                ...completionData,
                date: Timestamp.fromDate(completionData.date),
            };
            transaction.set(newDocRef, dataWithTimestamp);

            return { ref: newDocRef, totalCost: completionData.totalCost };
        });

        // --- Phase 4. Create Journal Entry (outside main transaction) ---
        const { totalCost } = newCompletionRef;
        const settings = await getAccountingSettings();
        const { inventoryAccountId } = settings; // Using one inventory account for simplicity
        
        if (!inventoryAccountId) {
            throw new Error('Akun Persediaan belum diatur di Pengaturan Akuntansi.');
        }

        // The journal for manufacturing is complex. For now, we assume one inventory account.
        // A correct entry would be: Dr. FG Inventory, Cr. RM Inventory, Cr. WIP-Labor, etc.
        // Simplified: The value is transferred within the same inventory account, so no net change.
        // We will create a journal to show the transformation.
        const journalDescription = `Penyelesaian Produksi WO #${completionData.workOrderId}`;
        const journalEntries: JournalEntry[] = [
            // This represents finished goods value increasing
            { accountId: inventoryAccountId, accountName: 'Persediaan Barang Jadi', debit: totalCost, credit: 0 },
             // This represents raw materials value decreasing
            { accountId: inventoryAccountId, accountName: 'Persediaan Bahan Baku', debit: 0, credit: totalCost }
        ];

        const newJournal: NewJournal = {
            date: completionData.date,
            description: journalDescription,
            refNumber: newCompletionRef.ref.id,
            entries: journalEntries,
            total: totalCost
        };

        await addJournalEntry(newJournal);

        revalidatePath('/(app)/production/worksheet');
        revalidatePath('/(app)/production/work-order');
        revalidatePath('/(app)/products');
        revalidatePath('/(app)/accounting/ledger');

        return createResponse(null, newCompletionRef.ref.id);
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}
