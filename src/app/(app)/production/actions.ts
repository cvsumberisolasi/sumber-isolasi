'use server';

import { revalidatePath } from "next/cache";
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, Timestamp, runTransaction, getDoc, DocumentData, getDocs, writeBatch } from "firebase/firestore";
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

export async function updateMultipleWorkOrderStatus(ids: string[], status: WorkOrder['status']) {
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const woRef = doc(db, 'workOrders', id);
            batch.update(woRef, { status });
        });
        await batch.commit();

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
            const settings = await getAccountingSettings();
            const { rawMaterialInventoryAccountId, wipAccountId, inventoryAccountId } = settings;
            if (!rawMaterialInventoryAccountId || !wipAccountId || !inventoryAccountId) {
                throw new Error("Akun persediaan produksi belum lengkap di Pengaturan Akuntansi.");
            }

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
            const journalEntries: JournalEntry[] = [];
            
            let totalRawMaterialCost = 0;

            // Update raw material stock
            for (const item of completionData.consumedItems) {
                const productInfo = productMap.get(item.productId);
                if (!productInfo) throw new Error(`Bahan baku ${item.productName} tidak ditemukan.`);
                
                const newStock = productInfo.data.stock - item.quantity;
                
                const itemCost = (productInfo.data.cost || 0) * item.quantity;
                totalRawMaterialCost += itemCost;
                
                updates.push({ ref: doc(db, 'products', item.productId), newStock });
            }
            
            // Journal for consuming raw materials (transferring value to WIP)
            if (totalRawMaterialCost > 0) {
                 journalEntries.push(
                    { accountId: wipAccountId, accountName: '', debit: totalRawMaterialCost, credit: 0 },
                    { accountId: rawMaterialInventoryAccountId, accountName: '', debit: 0, credit: totalRawMaterialCost }
                );
            }

            // Journal for consuming additional costs (transferring value to WIP)
            let totalAdditionalCost = 0;
            for (const addCost of completionData.additionalCosts) {
                if(addCost.amount > 0) {
                    journalEntries.push(
                        { accountId: wipAccountId, accountName: '', debit: addCost.amount, credit: 0 },
                        { accountId: addCost.accountId, accountName: '', debit: 0, credit: addCost.amount }
                    );
                    totalAdditionalCost += addCost.amount;
                }
            }

            const totalProductionCost = totalRawMaterialCost + totalAdditionalCost;
            
            // Journal for moving total WIP value to Finished Goods
            if (totalProductionCost > 0) {
                journalEntries.push(
                    { accountId: inventoryAccountId, accountName: '', debit: totalProductionCost, credit: 0 },
                    { accountId: wipAccountId, accountName: '', debit: 0, credit: totalProductionCost }
                );
            }


            // Update finished good stock and cost
            const finishedGoodInfo = productMap.get(completionData.finishedGoodId);
            if (!finishedGoodInfo) throw new Error(`Barang jadi ${completionData.finishedGoodName} tidak ditemukan.`);
            
            const newFinishedGoodStock = finishedGoodInfo.data.stock + completionData.quantityProduced;
            
            // Calculate new average cost for the finished good
            const existingTotalValue = (finishedGoodInfo.data.cost || 0) * finishedGoodInfo.data.stock;
            const newTotalValue = existingTotalValue + totalProductionCost;
            const newAverageCost = newFinishedGoodStock > 0 ? newTotalValue / newFinishedGoodStock : 0;
            
            updates.push({ 
                ref: doc(db, 'products', completionData.finishedGoodId), 
                newStock: newFinishedGoodStock,
                newCost: newAverageCost 
            });
            
            // --- Phase 3: All Writes ---
            for (const update of updates) {
                const updateData: {stock: number, cost?: number} = { stock: update.newStock };
                if (update.newCost !== undefined) {
                    updateData.cost = update.newCost;
                }
                transaction.update(update.ref, updateData);
            }

            const woRef = doc(db, 'workOrders', completionData.workOrderId);
            transaction.update(woRef, { status: 'Selesai' });

            const dataWithTimestamp = {
                ...completionData,
                date: Timestamp.fromDate(completionData.date),
                totalCost: totalProductionCost,
            };
            transaction.set(newDocRef, dataWithTimestamp);

            // Add journal entry if there are any entries to be made
            if (journalEntries.length > 0) {
                const newJournal: NewJournal = {
                    date: completionData.date,
                    description: `Penyelesaian Produksi WO #${completionData.workOrderId}`,
                    refNumber: newId,
                    entries: journalEntries,
                    total: totalProductionCost,
                };
    
                const journalRef = doc(collection(db, 'journals'));
                transaction.set(journalRef, {...newJournal, date: Timestamp.fromDate(newJournal.date as Date)});
            }


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

export async function completeMultipleProductions(workOrderIds: string[]) {
    try {
        const batch = writeBatch(db);
        const settings = await getAccountingSettings();
        const { rawMaterialInventoryAccountId, wipAccountId, inventoryAccountId } = settings;
        if (!rawMaterialInventoryAccountId || !wipAccountId || !inventoryAccountId) {
            throw new Error("Akun persediaan produksi belum lengkap di Pengaturan Akuntansi.");
        }
        
        for (const woId of workOrderIds) {
            const woRef = doc(db, 'workOrders', woId);
            const woSnap = await getDoc(woRef);
            if (!woSnap.exists()) continue;

            const wo = { id: woId, ...woSnap.data() } as WorkOrder;

            const bomRef = doc(db, 'billOfMaterials', wo.bomId);
            const bomSnap = await getDoc(bomRef);
            if (!bomSnap.exists()) continue;

            const bom = bomSnap.data() as BillOfMaterial;

            const productIds = [
                wo.finishedGoodId,
                ...bom.items.map(item => item.productId)
            ];

            const productSnaps = await Promise.all(
                productIds.map(id => getDoc(doc(db, 'products', id)))
            );

            const productMap = new Map<string, Product>();
            productSnaps.forEach(snap => {
                if (snap.exists()) productMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
            });

            // Calculate costs and prepare stock updates
            let totalRawMaterialCost = 0;
            const productionCycles = wo.quantityToProduce / bom.quantityProduced;

            for (const item of bom.items) {
                const product = productMap.get(item.productId);
                if (product) {
                    const newStock = product.stock - (item.quantity * productionCycles);
                    batch.update(doc(db, 'products', item.productId), { stock: newStock });
                    totalRawMaterialCost += (product.cost || 0) * item.quantity * productionCycles;
                }
            }

            const totalAdditionalCost = bom.additionalCosts?.reduce((sum, cost) => sum + (cost.amount * productionCycles), 0) || 0;
            const totalProductionCost = totalRawMaterialCost + totalAdditionalCost;
            
            // Update finished good stock and cost
            const finishedGood = productMap.get(wo.finishedGoodId);
            if (finishedGood) {
                const newStock = finishedGood.stock + wo.quantityToProduce;
                const newAverageCost = newStock > 0 ? (((finishedGood.cost || 0) * finishedGood.stock) + totalProductionCost) / newStock : 0;
                batch.update(doc(db, 'products', wo.finishedGoodId), { stock: newStock, cost: newAverageCost });
            }
            
            // Create Completion Record
            const completionId = generateDocumentId('PC');
            const completionRef = doc(db, 'productionCompletions', completionId);
            const completionData: NewProductionCompletion = {
                date: new Date(),
                workOrderId: wo.id,
                finishedGoodId: wo.finishedGoodId,
                finishedGoodName: wo.finishedGoodName,
                quantityProduced: wo.quantityToProduce,
                consumedItems: bom.items.map(i => ({...i, quantity: i.quantity * productionCycles})),
                additionalCosts: bom.additionalCosts?.map(c => ({...c, amount: c.amount * productionCycles})) || [],
                totalCost: totalProductionCost
            };
            batch.set(completionRef, {...completionData, date: Timestamp.fromDate(completionData.date as Date)});

            // Create Journal Entry
            const journalEntries: JournalEntry[] = [];
            if (totalRawMaterialCost > 0) {
                 journalEntries.push(
                    { accountId: wipAccountId, accountName: '', debit: totalRawMaterialCost, credit: 0 },
                    { accountId: rawMaterialInventoryAccountId, accountName: '', debit: 0, credit: totalRawMaterialCost }
                );
            }
            if (totalAdditionalCost > 0) {
                bom.additionalCosts?.forEach(cost => {
                     journalEntries.push(
                        { accountId: wipAccountId, accountName: '', debit: cost.amount * productionCycles, credit: 0 },
                        { accountId: cost.accountId, accountName: '', debit: 0, credit: cost.amount * productionCycles }
                    );
                })
            }
            if (totalProductionCost > 0) {
                journalEntries.push(
                    { accountId: inventoryAccountId, accountName: '', debit: totalProductionCost, credit: 0 },
                    { accountId: wipAccountId, accountName: '', debit: 0, credit: totalProductionCost }
                );
            }

            if (journalEntries.length > 0) {
                const journalId = doc(collection(db, 'journals'));
                const newJournal: NewJournal = {
                    date: new Date(),
                    description: `Penyelesaian Produksi WO #${wo.id}`,
                    refNumber: completionId,
                    entries: journalEntries,
                    total: totalProductionCost,
                };
                batch.set(journalId, {...newJournal, date: Timestamp.fromDate(newJournal.date as Date)});
            }

            // Update WO status
            batch.update(woRef, { status: 'Selesai' });
        }
        
        await batch.commit();

        revalidatePath('/(app)/production/worksheet');
        revalidatePath('/(app)/production/work-order');
        revalidatePath('/(app)/production/history');
        revalidatePath('/(app)/products');
        revalidatePath('/(app)/accounting/ledger');

        return createResponse(null, `${workOrderIds.length} WO(s) completed.`);
    } catch(e) {
        console.error("Error completing multiple productions:", e);
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}
