
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PurchaseRequestPageContent from "./request/page";
import PurchaseOrderPageContent from "./order/page";
import GoodsReceiptPageContent from "./goods-receipt/page";
import SupplierInvoicePageContent from "./invoice/page";
import AccountsPayablePageContent from "./payables/page";
import PurchaseReturnsPageContent from "./returns/page";

export default function PurchasingPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Manajemen Pembelian</h1>
            <Tabs defaultValue="request" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="request">Permintaan (PR)</TabsTrigger>
                    <TabsTrigger value="order">Pesanan (PO)</TabsTrigger>
                    <TabsTrigger value="goods-receipt">Penerimaan</TabsTrigger>
                    <TabsTrigger value="invoice">Faktur</TabsTrigger>
                    <TabsTrigger value="payables">Utang Usaha</TabsTrigger>
                    <TabsTrigger value="returns">Retur</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-6">
                    <PurchaseRequestPageContent />
                </TabsContent>
                <TabsContent value="order" className="mt-6">
                    <PurchaseOrderPageContent />
                </TabsContent>
                <TabsContent value="goods-receipt" className="mt-6">
                    <GoodsReceiptPageContent />
                </TabsContent>
                <TabsContent value="invoice" className="mt-6">
                    <SupplierInvoicePageContent />
                </TabsContent>
                <TabsContent value="payables" className="mt-6">
                    <AccountsPayablePageContent />
                </TabsContent>
                 <TabsContent value="returns" className="mt-6">
                    <PurchaseReturnsPageContent />
                </TabsContent>
            </Tabs>
        </div>
    )
}
