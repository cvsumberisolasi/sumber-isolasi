
'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';

export function AppShell({
  children,
  companyName
}: {
  children: React.ReactNode;
  companyName: string;
}) {
  return (
    <>
      <AppSidebar companyName={companyName} />
      <SidebarInset>
        <AppHeader companyName={companyName} />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <Suspense
            fallback={
                <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            }
            >
            {children}
            </Suspense>
        </main>
      </SidebarInset>
    </>
  );
}
