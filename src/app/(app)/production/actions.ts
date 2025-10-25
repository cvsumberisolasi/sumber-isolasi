
'use server';

import { revalidatePath } from "next/cache";
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, Timestamp, runTransaction, getDoc, DocumentData, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewBillOfMaterial, NewWorkOrder, WorkOrder, Product, BillOfMaterial, NewJournal, JournalEntry, ProductionCompletion, NewProductionCompletion, AdditionalCostItem } from "@/lib/types";
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
            const allProductIds = [
                completionData.finishedGoodId,
                ...completionData.consumedItems.map(item => item.productId)
            ];
            const productRefs = allProductIds.map(id => doc(db, 'products', id));
            const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
            
            const productMap = new Map<string, { doc: DocumentData, data: Product }>();
            productSnaps.forEach((snap, index) => {
                if (!snap.exists()) throw new Error(`Produk dengan ID ${allProductIds[index]} tidak ditemukan.`);
                productMap.set(snap.id, { doc: snap, data: snap.data() as Product });
            });
            
            // --- Phase 2: Logic & Validation (No DB Writes Yet) ---
            const updates: { ref: FirebaseFirestore.DocumentReference<DocumentData>, newStock: number, newCost?: number }[] = [];

            // Update raw material stock
            for (const item of completionData.consumedItems) {
                const productInfo = productMap.get(item.productId);
                if (!productInfo) throw new Error(`Bahan baku ${item.productName} tidak ditemukan.`);
                
                const newStock = productInfo.data.stock - item.quantity;
                if (newStock < 0) throw new Error(`Stok ${item.productName} tidak mencukupi.`);
                
                updates.push({ ref: doc(db, 'products', item.productId), newStock });
            }
            
            // Update finished good stock and cost
            const finishedGoodInfo = productMap.get(completionData.finishedGoodId);
            if (!finishedGoodInfo) throw new Error(`Barang jadi ${completionData.finishedGoodName} tidak ditemukan.`);
            
            const newFinishedGoodStock = finishedGoodInfo.data.stock + completionData.quantityProduced;
            
            // Calculate new average cost for the finished good
            const existingTotalValue = (finishedGoodInfo.data.cost || 0) * finishedGoodInfo.data.stock;
            const newTotalValue = existingTotalValue + completionData.totalCost;
            const newAverageCost = newTotalValue / newFinishedGoodStock;
            
            updates.push({ 
                ref: doc(db, 'products', completionData.finishedGoodId), 
                newStock: newFinishedGoodStock,
                newCost: newAverageCost 
            });
            
            // --- Phase 3: All Writes ---
            for (const update of updates) {
                const updateData: {stock: number, cost?: number} = { stock: update.newStock };
                if (update.newCost) {
                    updateData.cost = update.newCost;
                }
                transaction.update(update.ref, updateData);
            }

            const woRef = doc(db, 'workOrders', completionData.workOrderId);
            transaction.update(woRef, { status: 'Selesai' });

            const dataWithTimestamp = {
                ...completionData,
                date: Timestamp.fromDate(completionData.date),
            };
            transaction.set(newDocRef, dataWithTimestamp);

            return newDocRef;
        });
        
        revalidatePath('/(app)/production/worksheet');
        revalidatePath('/(app)/production/work-order');
        revalidatePath('/(app)/products');
        revalidatePath('/(app)/accounting/ledger');

        return createResponse(null, newCompletionRef.id);
    } catch (e) {
        console.error("Error completing production:", e);
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}
