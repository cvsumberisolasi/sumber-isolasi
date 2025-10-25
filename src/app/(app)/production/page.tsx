
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BomPageContent from "./bom/page-content";
import WorkOrderPageContent from "./work-order/page-content";
import WorksheetPageContent from "./worksheet/page-content";

export default function ProductionPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Manufaktur & Produksi</h1>
            <Tabs defaultValue="work-order">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="bom">Formula (BOM)</TabsTrigger>
                    <TabsTrigger value="work-order">Perintah Produksi (WO)</TabsTrigger>
                    <TabsTrigger value="worksheet">Lembar Kerja</TabsTrigger>
                </TabsList>
                <TabsContent value="bom" className="mt-6">
                    <BomPageContent />
                </TabsContent>
                <TabsContent value="work-order" className="mt-6">
                    <WorkOrderPageContent />
                </TabsContent>
                <TabsContent value="worksheet" className="mt-6">
                    <WorksheetPageContent />
                </TabsContent>
            </Tabs>
        </div>
    )
}
