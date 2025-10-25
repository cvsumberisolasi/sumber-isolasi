
"use server";

import { revalidatePath } from "next/cache";
import { collection, writeBatch, getDocs, query, doc, getDoc, where, Query, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction, SalesReturn, GoodsReceipt, PurchaseReturn, StockOpname, Product } from "@/lib/types";

const createResponse = (error: string | null = null) => ({ error });

async function deleteDocumentsInBatches(q: Query) {
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    
    const BATCH_SIZE = 500;
    let i = 0;
    let batch = writeBatch(db);
    
    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        i++;
        if (i % BATCH_SIZE === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    
    if (i % BATCH_SIZE !== 0) {
        await batch.commit();
    }
}


export async function deleteCashInJournals() {
    try {
        const q = query(collection(db, "journals"), where('description', '>=', 'Kas Masuk:'), where('description', '<', 'Kas Masuk:' + '\uf8ff'));
        await deleteDocumentsInBatches(q);
        revalidateAllPaths();
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : `Gagal menghapus jurnal Kas Masuk.`);
    }
}

export async function deleteCashOutJournals() {
    try {
        const q = query(collection(db, "journals"), where('description', '>=', 'Kas Keluar:'), where('description', '<', 'Kas Keluar:' + '\uf8ff'));
        await deleteDocumentsInBatches(q);
        revalidateAllPaths();
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : `Gagal menghapus jurnal Kas Keluar.`);
    }
}

export async function deleteCashTransferJournals() {
    try {
        const q = query(collection(db, "journals"), where('description', '>=', 'Transfer:'), where('description', '<', 'Transfer:' + '\uf8ff'));
        await deleteDocumentsInBatches(q);
        revalidateAllPaths();
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : `Gagal menghapus jurnal Transfer Kas.`);
    }
}


export async function deleteSingleCollection(collectionName: string) {
    try {
        const docsToDelete = await getDocs(query(collection(db, collectionName)));
        const stockAdjustments: { [productId: string]: number } = {};

        if (!docsToDelete.empty) {
            const BATCH_SIZE = 500;
            let i = 0;
            let batch = writeBatch(db);
            
            for (const docSnap of docsToDelete.docs) {
                batch.delete(docSnap.ref);
                const data = docSnap.data();

                // Logic for stock reversion based on collection type
                switch (collectionName) {
                    case 'transactions':
                        const tx = data as Transaction;
                        tx.items.forEach(item => {
                            stockAdjustments[item.productId] = (stockAdjustments[item.productId] || 0) + item.quantity;
                        });
                        break;
                    case 'salesReturns':
                        const sr = data as SalesReturn;
                        sr.items.forEach(item => {
                            stockAdjustments[item.productId] = (stockAdjustments[item.productId] || 0) - item.quantity;
                        });
                        break;
                    case 'goodsReceipts':
                        const gr = data as GoodsReceipt;
                        gr.items.forEach(item => {
                            stockAdjustments[item.productId] = (stockAdjustments[item.productId] || 0) - item.receivedQuantity;
                        });
                        break;
                    case 'purchaseReturns':
                        const pr = data as PurchaseReturn;
                        pr.items.forEach(item => {
                            stockAdjustments[item.productId] = (stockAdjustments[item.productId] || 0) + item.returnQuantity;
                        });
                        break;
                    case 'stockOpnames':
                        const so = data as StockOpname;
                        so.items.forEach(item => {
                            stockAdjustments[item.productId] = (stockAdjustments[item.productId] || 0) - item.difference;
                        });
                        break;
                }
                
                i++;
                if (i % BATCH_SIZE === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                }
            }
            if (i % BATCH_SIZE !== 0) {
                await batch.commit();
            }

            // Apply stock adjustments
            const productIds = Object.keys(stockAdjustments);
            if (productIds.length > 0) {
                let productBatch = writeBatch(db);
                let j = 0;
                for (const productId of productIds) {
                    const productRef = doc(db, 'products', productId);
                    const productSnap = await getDoc(productRef);
                    if (productSnap.exists()) {
                        const productData = productSnap.data() as Product;
                        const currentStock = productData.stock || 0;
                        productBatch.update(productRef, { stock: currentStock + stockAdjustments[productId] });
                        
                        j++;
                        if (j % BATCH_SIZE === 0) {
                            await productBatch.commit();
                            productBatch = writeBatch(db);
                        }
                    }
                }
                 if (j % BATCH_SIZE !== 0) {
                    await productBatch.commit();
                }
            }
        }
        
        revalidateAllPaths();
        return createResponse();
    } catch(e) {
        return createResponse(e instanceof Error ? e.message : `Gagal menghapus koleksi ${collectionName}.`);
    }
}


export async function resetAllProductStock() {
    try {
        const productsSnapshot = await getDocs(collection(db, 'products'));

        if (productsSnapshot.empty) {
            return createResponse("Tidak ada produk untuk direset.");
        }
        
        const BATCH_SIZE = 500;
        let i = 0;
        let batch = writeBatch(db);
        
        for (const doc of productsSnapshot.docs) {
            batch.update(doc.ref, { stock: 0 });
            i++;
            if (i % BATCH_SIZE === 0) {
                await batch.commit();
                batch = writeBatch(db);
            }
        }

        if (i % BATCH_SIZE !== 0) {
            await batch.commit();
        }

        revalidateAllPaths();
        return createResponse();
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : "Gagal mereset stok produk.");
    }
}


// Helper to revalidate all relevant paths after deletion
function revalidateAllPaths() {
    const paths = [
        "/",
        "/(app)/dashboard",
        "/(app)/pos",
        "/(app)/pos/parked",
        "/(app)/transactions",
        "/(app)/sales",
        "/(app)/sales/manual-input",
        "/(app)/sales/receivables",
        "/(app)/sales/returns",
        "/(app)/sales/import",
        "/(app)/products",
        "/(app)/products/list",
        "/(app)/products/categories",
        "/(app)/products/import",
        "/(app)/stock/warehouses",
        "/(app)/stock/notifications",
        "/(app)/stock/transfer",
        "/(app)/stock/opname",
        "/(app)/customers",
        "/(app)/suppliers",
        "/(app)/purchasing",
        "/(app)/purchasing/request",
        "/(app)/purchasing/order",
        "/(app)/purchasing/goods-receipt",
        "/(app)/purchasing/invoice",
        "/(app)/purchasing/payables",
        "/(app)/purchasing/returns",
        "/(app)/accounting/coa",
        "/(app)/accounting/journal",
        "/(app)/accounting/ledger",
        "/(app)/accounting/closing",
        "/(app)/accounting/post-closing-trial-balance",
        "/(app)/reports",
        "/(app)/reports/sales",
        "/(app)/reports/purchasing",
        "/(app)/reports/stock",
        "/(app)/reports/production",
        "/(app)/reports/expenses",
        "/(app)/reports/financial",
        "/(app)/reports/balance-sheet",
        "/(app)/reports/cash-flow",
        "/(app)/settings",
        "/(app)/settings/accounting",
        "/(app)/settings/marketplace",
        "/(app)/settings/danger",
        "/(app)/taxes",
        "/(app)/currencies",
        "/(app)/users",
        "/(app)/cash/in",
        "/(app)/cash/out",
        "/(app)/cash/transfer",
        "/(app)/production",
    ];
    paths.forEach(path => revalidatePath(path));
}
