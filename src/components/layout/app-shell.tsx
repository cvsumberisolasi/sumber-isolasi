
'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AppHeader } from './app-header';
import { SidebarInset } from '@/components/ui/sidebar';
import type { CompanySettings } from '@/app/(app)/settings/actions';
import { AppSidebar } from './app-sidebar';

export function AppShell({
  children,
  companySettings,
}: {
  children: React.ReactNode;
  companySettings: CompanySettings;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar companySettings={companySettings} />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <AppHeader />
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
        </div>
    </div>
  );
}
