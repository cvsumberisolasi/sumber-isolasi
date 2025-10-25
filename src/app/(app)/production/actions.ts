
'use server';

import { revalidatePath } from "next/cache";
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewBillOfMaterial, NewWorkOrder, WorkOrder } from "@/lib/types";
import { generateDocumentId } from "@/lib/utils";

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
        return createResponse();
    } catch (e) {
        return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
    }
}
