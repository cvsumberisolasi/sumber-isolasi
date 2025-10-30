

"use server";

import {
  collection,
  doc,
  runTransaction,
  Timestamp,
  writeBatch,
  getDocs,
  getDoc,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  NewTransaction,
  Product,
  JournalEntry,
  NewJournal,
  ImportRow,
  NewCustomer,
  ProductUnit,
} from '@/lib/types';
import { addJournalEntry } from '@/app/(app)/accounting/journal/actions';
import { getAccountingSettings } from '@/app/(app)/settings/accounting/actions';
import { generateDocumentId } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

const createResponse = (
  error: string | null = null,
  id: string | null = null
) => ({ error, id });


async function queryInChunks<T>(
  ref: any,
  field: string,
  values: string[],
  chunkSize: number = 30
): Promise<T[]> {
  if (values.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }

  const results: T[] = [];
  for (const chunk of chunks) {
    const q = query(ref, where(field, 'in', chunk));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() } as T);
    });
  }
  return results;
}


export async function importMarketplaceTransactions(
  transactions: ImportRow[]
) {
  if (!transactions || transactions.length === 0) {
    return createResponse('Tidak ada transaksi untuk diimpor.');
  }

  const settings = await getAccountingSettings();
  const {
    salesRevenueAccountId,
    cogsAccountId,
    inventoryAccountId,
    accountsReceivableAccountId,
  } = settings;

  const requiredAccountIds = [
    salesRevenueAccountId,
    cogsAccountId,
    inventoryAccountId,
    accountsReceivableAccountId,
  ];

  if (requiredAccountIds.some((id) => !id)) {
    return createResponse(
      `Gagal membuat jurnal otomatis: Pengaturan pemetaan akun belum lengkap. Mohon lengkapi di menu Pengaturan > Akuntansi.`
    );
  }

  const groupedByOrder = transactions.reduce((acc, row) => {
    if (!row.mappedProduct) return acc;
    const orderId = row.nomor_order;
    if (!acc[orderId]) {
      acc[orderId] = {
        items: [],
        total: 0,
        totalCost: 0,
        discount: 0,
        fee: 0,
        netTotal: 0,
        customerName: row.nama_pembeli || `Pelanggan ${row.channel}`,
        customerAddress: row.alamat_lengkap,
        channel: row.channel,
        date: new Date(row.tanggal_order),
      };
    }
    
    const cost = row.cost || row.mappedProduct.cost || 0;
    const itemSubtotal = row.unit_price * row.qty;

    acc[orderId].items.push({
      productId: row.mappedProduct.id,
      productName: row.mappedProduct.name,
      quantity: row.qty,
      price: row.unit_price,
      cost: cost,
      unit: row.mappedProduct.baseUnit,
    });
    
    acc[orderId].total += itemSubtotal;
    acc[orderId].totalCost += cost * row.qty;
    acc[orderId].discount += row.discount;
    acc[orderId].fee += row.fee;
    acc[orderId].netTotal += row.net_total;

    return acc;
  }, {} as Record<string, any>);

  try {
    
    const allProductIds = [
      ...new Set(
        transactions.map(t => t.mappedProduct?.id).filter(Boolean) as string[]
      ),
    ];
    const productDocs = await queryInChunks<{id: string} & Product>(
        collection(db, 'products'),
        '__name__',
        allProductIds
    );
    const productMap: Map<string, Product> = new Map(productDocs.map(p => [p.id, p]));

    await runTransaction(db, async (transaction) => {
      const uniqueCustomers = Object.values(groupedByOrder).reduce((acc, order) => {
          if (order.customerName) {
              acc[order.customerName] = order.customerAddress || '';
          }
          return acc;
      }, {} as {[name: string]: string});
      
      const customerNames = Object.keys(uniqueCustomers);
      if (customerNames.length > 0) {
        const existingCustomers = await queryInChunks<NewCustomer>(collection(db, 'customers'), 'name', customerNames);
        const existingCustomerNames = new Set(existingCustomers.map(c => c.name));
        
        for (const name in uniqueCustomers) {
            if (!existingCustomerNames.has(name)) {
                const newCustomerRef = doc(collection(db, 'customers'));
                const newCustomerData: NewCustomer = {
                    name,
                    email: '',
                    phone: '',
                    address: uniqueCustomers[name],
                };
                transaction.set(newCustomerRef, newCustomerData);
            }
        }
      }

      const productUpdates = new Map<string, { stock: number; cost?: number; units?: ProductUnit[]; sku?: string }>();

      for (const row of transactions) {
          if (!row.mappedProduct) continue;
          const productId = row.mappedProduct.id;
          const product = productMap.get(productId);
          if (!product) continue;

          let currentUpdate = productUpdates.get(productId) || { stock: product.stock };
          
          currentUpdate.stock -= row.qty;

          if (row.cost > 0 && row.cost !== product.cost) {
              currentUpdate.cost = row.cost;
          }

          const baseUnit = product.units.find(u => u.name === product.baseUnit);
          if (row.unit_price > 0 && baseUnit && row.unit_price !== baseUnit.price) {
              const newUnits = product.units.map(u => 
                  u.name === product.baseUnit ? { ...u, price: row.unit_price } : u
              );
              currentUpdate.units = newUnits;
          }
          
          if (row.sku && product.sku !== row.sku) {
            currentUpdate.sku = row.sku;
          }
          
          productUpdates.set(productId, currentUpdate);
      }
      
      for (const [productId, updates] of productUpdates.entries()) {
          const productRef = doc(db, 'products', productId);
          transaction.update(productRef, updates);
      }

      for (const orderId in groupedByOrder) {
        const order = groupedByOrder[orderId];
        const newId = generateDocumentId('MKT');
        const newTxRef = doc(db, 'transactions', newId);

        const newTransaction: NewTransaction = {
          date: Timestamp.fromDate(order.date),
          items: order.items,
          total: order.total,
          discount: order.discount,
          fee: order.fee,
          netTotal: order.netTotal,
          paymentMethod: 'Kredit',
          customerName: order.customerName,
          status: 'Belum Lunas',
          channel: order.channel,
        };
        transaction.set(newTxRef, newTransaction);
        
        const journalDescription = `Penjualan Marketplace #${orderId}`;
        
        // REVISED JOURNAL LOGIC
        const journalEntries: JournalEntry[] = [
          { accountId: accountsReceivableAccountId!, accountName: '', debit: order.total, credit: 0 },
          { accountId: salesRevenueAccountId!, accountName: '', debit: 0, credit: order.total }
        ];

        const newJournal: NewJournal = {
          date: order.date,
          description: journalDescription,
          refNumber: newId,
          entries: journalEntries,
          total: order.total,
        };
        const newJournalRef = doc(collection(db, 'journals'));
        transaction.set(newJournalRef, {
          ...newJournal,
          date: Timestamp.fromDate(newJournal.date as Date),
        });
        
        if (order.totalCost > 0) {
            const cogsJournal: NewJournal = {
              date: order.date,
              description: `HPP untuk Marketplace #${orderId}`,
              refNumber: newId,
              entries: [
                  { accountId: cogsAccountId!, accountName: '', debit: order.totalCost, credit: 0 },
                  { accountId: inventoryAccountId!, accountName: '', debit: 0, credit: order.totalCost },
              ],
              total: order.totalCost,
            };
            const newCogsJournalRef = doc(collection(db, 'journals'));
            transaction.set(newCogsJournalRef, {
              ...cogsJournal,
              date: Timestamp.fromDate(cogsJournal.date as Date),
            });
        }
      }
    });

    revalidatePath('/(app)/transactions');
    revalidatePath('/(app)/products');
    revalidatePath('/(app)/dashboard');
    revalidatePath('/(app)/accounting/ledger');
    revalidatePath('/(app)/customers');
    revalidatePath('/(app)/sales/receivables');
    revalidatePath('/(app)/reports');


    return createResponse(null, `${Object.keys(groupedByOrder).length}`);
  } catch (e) {
    console.error('Error importing marketplace transactions: ', e);
    return createResponse(
      e instanceof Error ? e.message : 'An unknown error occurred.'
    );
  }
}
