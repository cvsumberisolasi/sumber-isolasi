
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductsListPage from "./list/page";
import ProductCategoriesPage from "./categories/page";
import WarehousesPage from "@/app/(app)/stock/warehouses/page";
import StockTransferPage from "@/app/(app)/stock/transfer/page";
import StockOpnamePage from "@/app/(app)/stock/opname/page";


export default function ProductsPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Produk & Stok</h1>
            <Tabs defaultValue="products-list">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="products-list">Daftar Produk</TabsTrigger>
                    <TabsTrigger value="categories">Kategori</TabsTrigger>
                    <TabsTrigger value="warehouses">Gudang</TabsTrigger>
                    <TabsTrigger value="transfer">Transfer Stok</TabsTrigger>
                    <TabsTrigger value="opname">Stock Opname</TabsTrigger>
                </TabsList>
                <TabsContent value="products-list" className="mt-6">
                    <ProductsListPage />
                </TabsContent>
                <TabsContent value="categories" className="mt-6">
                    <ProductCategoriesPage />
                </TabsContent>
                 <TabsContent value="warehouses" className="mt-6">
                    <WarehousesPage />
                </TabsContent>
                 <TabsContent value="transfer" className="mt-6">
                    <StockTransferPage />
                </TabsContent>
                 <TabsContent value="opname" className="mt-6">
                    <StockOpnamePage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
