

"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AccountingSettings = {
  cashAccountId?: string;
  bankAccountId?: string;
  salesRevenueAccountId?: string;
  salesDiscountAccountId?: string;
  marketplaceFeeAccountId?: string;
  cogsAccountId?: string;
  inventoryAccountId?: string; // Finished Goods Inventory
  accountsReceivableAccountId?: string;
  accountsPayableAccountId?: string;
  accruedPayableAccountId?: string; // Goods Received Not Invoiced
  retainedEarningsAccountId?: string;
  incomeSummaryAccountId?: string;
  taxPayableAccountId?: string;
  
  // Production Accounts
  rawMaterialInventoryAccountId?: string;
  wipAccountId?: string; // Work-in-Progress
  directLaborAccountId?: string;
  manufacturingOverheadAccountId?: string;
};

const settingsDocRef = doc(db, "settings", "accounting");

export async function getAccountingSettings(): Promise<AccountingSettings> {
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as AccountingSettings;
    }
    return {}; // Return empty object if no settings found
  } catch (error) {
    console.error("Error fetching accounting settings: ", error);
    return {};
  }
}

export async function updateAccountingSettings(settingsData: AccountingSettings) {
  try {
    await setDoc(settingsDocRef, settingsData, { merge: true });
    revalidatePath("/(app)/settings/accounting");
    return { error: null };
  } catch (e) {
    console.error("Error updating settings: ", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    return { error: errorMessage };
  }
}
