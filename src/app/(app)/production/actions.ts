
'use server';

import { revalidatePath } from "next/cache";
import { collection, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewBillOfMaterial, BillOfMaterial } from "@/lib/types";

const createResponse = (error: string | null = null) => ({ error });

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
