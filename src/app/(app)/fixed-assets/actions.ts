
'use server';

import { revalidatePath } from 'next/cache';
import { collection, doc, addDoc, writeBatch, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NewFixedAsset, FixedAsset, NewJournal, JournalEntry } from '@/lib/types';
import { addJournalEntry } from '@/app/(app)/accounting/journal/actions';

const createResponse = (error: string | null = null) => ({ error });

export async function addFixedAsset(assetData: NewFixedAsset, paymentAccountId: string) {
  try {
    // 1. Add the asset document
    const newAssetRef = doc(collection(db, 'fixedAssets'));
     const assetWithTimestamp = {
      ...assetData,
      acquisitionDate: Timestamp.fromDate(assetData.acquisitionDate),
    };
    
    // 2. Create the acquisition journal entry
    const journalDescription = `Pembelian Aset Tetap: ${assetData.name}`;
    const journalEntries: JournalEntry[] = [
      { accountId: assetData.assetAccountId, accountName: assetData.assetAccountName, debit: assetData.acquisitionCost, credit: 0 },
      { accountId: paymentAccountId, accountName: '', debit: 0, credit: assetData.acquisitionCost },
    ];
    const newJournal: NewJournal = {
      date: assetData.acquisitionDate,
      description: journalDescription,
      refNumber: newAssetRef.id,
      entries: journalEntries,
      total: assetData.acquisitionCost,
    };
    
    const batch = writeBatch(db);
    batch.set(newAssetRef, assetWithTimestamp);
    
    // addJournalEntry handles its own revalidation and timestamp conversion
    const journalResult = await addJournalEntry(newJournal);
    if(journalResult.error) {
        throw new Error(`Gagal membuat jurnal akuisisi: ${journalResult.error}`);
    }

    // Since addJournalEntry has its own commit, we only need to commit the asset addition here.
    await batch.commit();

    revalidatePath('/(app)/fixed-assets/list');
    return createResponse();
  } catch (e) {
    console.error('Error adding fixed asset:', e);
    return createResponse(e instanceof Error ? e.message : 'An unknown error occurred.');
  }
}


export async function runDepreciation(month: number, year: number) {
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        // Fetch all assets that are active during the period
        const assetsQuery = query(
            collection(db, 'fixedAssets'),
            where('acquisitionDate', '<=', Timestamp.fromDate(endDate))
        );
        const assetsSnapshot = await getDocs(assetsQuery);

        if (assetsSnapshot.empty) {
            return createResponse("Tidak ada aset untuk disusutkan pada periode ini.");
        }

        const assets = assetsSnapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data,
                acquisitionDate: (data.acquisitionDate as Timestamp).toDate()
            } as FixedAsset
        });

        const journalEntries: JournalEntry[] = [];
        let totalMonthlyDepreciation = 0;
        let assetsDepreciatedCount = 0;

        assets.forEach(asset => {
            const acquisitionDate = asset.acquisitionDate;
            // Don't depreciate in the month of acquisition for simplicity
            if(acquisitionDate.getFullYear() === year && acquisitionDate.getMonth() === month - 1) {
                return;
            }

            const monthlyDepreciation = asset.acquisitionCost / (asset.usefulLife * 12);
            
            if(monthlyDepreciation > 0) {
                journalEntries.push(
                    { accountId: asset.depreciationExpenseAccountId, accountName: asset.depreciationExpenseAccountName, debit: monthlyDepreciation, credit: 0 },
                    { accountId: asset.accumulatedDepreciationAccountId, accountName: asset.accumulatedDepreciationAccountName, debit: 0, credit: monthlyDepreciation }
                );
                totalMonthlyDepreciation += monthlyDepreciation;
                assetsDepreciatedCount++;
            }
        });
        
        if (journalEntries.length === 0) {
             return createResponse("Tidak ada penyusutan untuk dihitung pada periode ini.");
        }
        
        const getMonthName = (m: number) => new Date(2000, m - 1, 1).toLocaleString('id-ID', { month: 'long' });
        const description = `Penyusutan Aset Periode ${getMonthName(month)} ${year}`;

        const newJournal: NewJournal = {
            date: endDate,
            description,
            refNumber: `DEP-${year}-${month}`,
            entries: journalEntries,
            total: totalMonthlyDepreciation
        };

        const journalResult = await addJournalEntry(newJournal);
        if (journalResult.error) {
            throw new Error(`Gagal membuat jurnal penyusutan: ${journalResult.error}`);
        }
        
        const historyRef = doc(collection(db, 'depreciationRuns'));
        await addDoc(collection(db, 'depreciationRuns'), {
            date: Timestamp.now(),
            month,
            year,
            journalId: journalResult.id,
            totalDepreciation: totalMonthlyDepreciation,
            assetsDepreciated: assetsDepreciatedCount,
        });

        revalidatePath('/(app)/fixed-assets/depreciation');
        return createResponse();

    } catch(e) {
        console.error("Error running depreciation:", e);
        return createResponse(e instanceof Error ? e.message : "An unknown error occurred.");
    }
}
