

"use server";

import { revalidatePath } from "next/cache";
import { collection, writeBatch, getDocs, query, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { COA_SEED_DATA } from "@/lib/coa-seed";
import { CUSTOMERS_SEED_DATA } from "@/lib/customers-seed";
import { PRODUCTS_SEED_DATA } from "@/lib/products-seed";
import { SUPPLIERS_SEED_DATA } from "@/lib/suppliers-seed";
import { CURRENCIES_SEED_DATA } from "@/lib/currencies-seed";
import { TAXES_SEED_DATA } from "@/lib/taxes-seed";
import type { NewAccount } from "./types";
import type { AccountingSettings } from "@/app/(app)/settings/accounting/actions";

const createResponse = (error: string | null = null) => ({ error });

async function seedCollection(collectionName: string, data: any[], revalidationPath: string) {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(query(colRef));
    
    if (!snapshot.empty && collectionName !== 'taxes') { // Allow re-seeding taxes
      return createResponse(`${collectionName} sudah berisi data. Proses seed dibatalkan.`);
    }
    
    const batch = writeBatch(db);
    const docRefs: { [key: string]: string } = {}; // To store name -> id mapping

    data.forEach((item: NewAccount) => {
      const newDocRef = doc(colRef);
      batch.set(newDocRef, item);
      if (item.name) {
          docRefs[item.name] = newDocRef.id;
      }
    });

    await batch.commit();
    revalidatePath(revalidationPath);
    return { error: null, docRefs };
  } catch(e) {
    console.error(`Error seeding ${collectionName}: `, e);
    return { error: e instanceof Error ? e.message : "An unknown error occurred.", docRefs: null };
  }
}

export async function seedInitialAccounts() {
  const result = await seedCollection("coa", COA_SEED_DATA, "/(app)/accounting/coa");

  if (result.error || !result.docRefs) {
      return createResponse(result.error);
  }

  try {
    const docRefs = result.docRefs;

    const settingsData: AccountingSettings = {
        cashAccountId: docRefs['Kas Kecil'],
        bankAccountId: docRefs['Kas pada Bank ABC'],
        accountsReceivableAccountId: docRefs['Piutang Usaha'],
        accountsPayableAccountId: docRefs['Utang Usaha'],
        accruedPayableAccountId: docRefs['Utang Barang Diterima'],
        salesRevenueAccountId: docRefs['Pendapatan Penjualan Produk'],
        salesDiscountAccountId: docRefs['Diskon Penjualan'],
        marketplaceFeeAccountId: docRefs['Beban Marketplace'],
        cogsAccountId: docRefs['Beban Pokok Penjualan'],
        inventoryAccountId: docRefs['Persediaan Barang Dagang'],
        retainedEarningsAccountId: docRefs['Laba Ditahan'],
        incomeSummaryAccountId: docRefs['Ikhtisar Laba Rugi'],
        taxPayableAccountId: docRefs['Utang PPN (PPN Keluaran)'],
        taxReceivableAccountId: docRefs['Pajak Dibayar di Muka (PPN Masukan)'],
        rawMaterialInventoryAccountId: docRefs['Persediaan Bahan Baku'],
        wipAccountId: docRefs['Persediaan Barang Dalam Proses'],
        directLaborAccountId: docRefs['Biaya Tenaga Kerja Langsung'],
        manufacturingOverheadAccountId: docRefs['Biaya Overhead Pabrik'],
    };

    if (Object.values(settingsData).some(id => !id)) {
        console.error("Could not find all required accounts in the seed data to create mappings.", settingsData);
        return createResponse("Gagal membuat pemetaan akun otomatis: tidak semua akun standar ditemukan.");
    }
    
    const settingsDocRef = doc(db, "settings", "accounting");
    await setDoc(settingsDocRef, settingsData, { merge: true });
    revalidatePath("/(app)/settings/accounting");

    return createResponse();

  } catch(e) {
      console.error("Error seeding accounting settings: ", e);
      return createResponse(e instanceof Error ? e.message : "An unknown error occurred while seeding settings.");
  }
}

export async function seedInitialCustomers() {
  return seedCollection("customers", CUSTOMERS_SEED_DATA, "/(app)/customers");
}

export async function seedInitialProducts() {
  return seedCollection("products", PRODUCTS_SEED_DATA, "/(app)/products");
}

export async function seedInitialSuppliers() {
  return seedCollection("suppliers", SUPPLIERS_SEED_DATA, "/(app)/suppliers");
}

export async function seedInitialCurrencies() {
  return seedCollection("currencies", CURRENCIES_SEED_DATA, "/(app)/currencies");
}

export async function seedInitialTaxes() {
  return seedCollection("taxes", TAXES_SEED_DATA, "/(app)/taxes");
}
