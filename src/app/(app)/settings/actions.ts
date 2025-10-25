"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CompanySettings = {
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoDataUrl?: string;
};

const settingsDocRef = doc(db, "settings", "companyProfile");

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as CompanySettings;
    }
    return {}; // Return empty object if no settings found
  } catch (error) {
    console.error("Error fetching company settings: ", error);
    return {};
  }
}

export async function updateCompanySettings(settingsData: CompanySettings) {
  try {
    await setDoc(settingsDocRef, settingsData, { merge: true });
    revalidatePath("/(app)/settings");
    revalidatePath("/(app)/layout");
    return { error: null };
  } catch (e) {
    console.error("Error updating settings: ", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    return { error: errorMessage };
  }
}
