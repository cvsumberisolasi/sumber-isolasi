
"use server";

import { revalidatePath } from "next/cache";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewTax } from "@/lib/types";

const createResponse = (error: string | null = null) => ({ error });

export async function addTax(data: NewTax) {
  try {
    await addDoc(collection(db, "taxes"), data);
    revalidatePath("/(app)/taxes");
    return createResponse();
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}

export async function updateTax(id: string, data: Partial<NewTax>) {
   try {
    await updateDoc(doc(db, "taxes", id), data);
    revalidatePath("/(app)/taxes");
    return createResponse();
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}

export async function deleteTax(id: string) {
   try {
    await deleteDoc(doc(db, "taxes", id));
    revalidatePath("/(app)/taxes");
    return createResponse();
  } catch (e) {
    return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
  }
}
