
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssetListPage from "./list/page";
import AssetDepreciationPage from "./depreciation/page";

export default function FixedAssetsPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Aset Tetap</h1>
            <Tabs defaultValue="list">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="list">Daftar Aset</TabsTrigger>
                    <TabsTrigger value="depreciation">Penyusutan Aset</TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="mt-6">
                    <AssetListPage />
                </TabsContent>
                <TabsContent value="depreciation" className="mt-6">
                    <AssetDepreciationPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
