
'use server';

import { revalidatePath } from "next/cache";
import { collection, addDoc, doc, updateDoc, deleteDoc, setDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SkuMapping } from "@/lib/types";

const createResponse = (error: string | null = null, id: string | null = null) => ({ error, id });

export async function addOrUpdateSkuMapping(data: Partial<SkuMapping> & { marketplaceSku: string }) {
    try {
        const mappingsRef = collection(db, "skuMappings");
        
        // Check if a mapping for this SKU already exists
        const q = query(mappingsRef, where("marketplaceSku", "==", data.marketplaceSku));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Update the existing document
            const existingDocRef = querySnapshot.docs[0].ref;
            await updateDoc(existingDocRef, data);
            revalidatePath('/(app)/sales/import/mapping');
            return createResponse(null, existingDocRef.id);
        } else {
            // Add a new document
            const docRef = await addDoc(mappingsRef, data);
            revalidatePath('/(app)/sales/import/mapping');
            return createResponse(null, docRef.id);
        }
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}

export async function deleteSkuMapping(id: string) {
    try {
        await deleteDoc(doc(db, "skuMappings", id));
        revalidatePath('/(app)/sales/import/mapping');
        return createResponse();
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}
