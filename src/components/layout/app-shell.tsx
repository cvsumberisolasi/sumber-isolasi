
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
      <SidebarInset>
        <AppSidebar companySettings={companySettings} />
        <div className="flex-1 flex flex-col min-w-0">
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
      </SidebarInset>
  );
}
