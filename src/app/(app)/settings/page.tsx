
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsPageContent from "./profile/page";
import AccountingSettingsPage from "./accounting/page";
import MarketplaceSettingsPage from "./marketplace/page";
import ThemeSettingsPage from "./theme/page";
import DangerZonePage from "./danger/page";

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Pengaturan</h1>
            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                    <TabsTrigger value="profile">Profil Perusahaan</TabsTrigger>
                    <TabsTrigger value="accounting">Akuntansi</TabsTrigger>
                    <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                    <TabsTrigger value="theme">Tampilan</TabsTrigger>
                    <TabsTrigger value="danger">Data & Reset</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="mt-6">
                    <SettingsPageContent />
                </TabsContent>
                <TabsContent value="accounting" className="mt-6">
                    <AccountingSettingsPage />
                </TabsContent>
                <TabsContent value="marketplace" className="mt-6">
                    <MarketplaceSettingsPage />
                </TabsContent>
                <TabsContent value="theme" className="mt-6">
                    <ThemeSettingsPage />
                </TabsContent>
                <TabsContent value="danger" className="mt-6">
                    <DangerZonePage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
