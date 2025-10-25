
'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { getCompanySettings } from '@/app/(app)/settings/actions';
import { ThemeProvider } from './theme-provider';

// This component is now responsible for fetching company settings and providing the theme.
// However, since it's a client component, we'll use a wrapper or a hook.
// For simplicity, let's assume we need to adjust this.
// The problem is AppLayout is async and a server component, but it contains client components.
// Let's make AppShell the one that fetches, but we need to do it in a client-compatible way, or restructure.

// The best fix is to make AppLayout a standard Server Component that fetches data
// and passes it down to client components. The current structure is a bit mixed up.

// Re-thinking the fix based on the error. The error is about updating Router during render.
// The stack trace points to getCompanySettings. This is often an issue with how async components are nested.
// AppLayout is an async Server Component. That's fine. It calls getCompanySettings. Also fine.
// The problem might be that it's wrapping children that might include client components causing this conflict.

// Let's try a different approach. The error comes from AppLayout.
// Let's make AppShell a simple client component again, and have AppLayout fetch and pass the name.

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

// The error is actually in how AppLayout is structured.
// It's an async component, which is fine. But it's also a layout,
// which means it wraps client components.
// The issue is likely the direct call to `getCompanySettings` inside the layout.

// The correct fix is to separate the data fetching logic.
// We'll create a new server component that fetches the data and then renders the AppShell.
// But the original code was passing `companyName` to `AppShell`. Let's restore that pattern.
// It seems I might have over-corrected in a previous step.

// Let's restore the original intent and fix the actual issue.
// The user's last code change involved `SettingsPage`. The error points to `AppLayout`.

// Let's correct AppLayout and AppShell to properly handle this.
// `AppLayout` will be the async component that fetches data.
// It will pass the data to `AppShell`, which will be a client component.
// `AppShell` will contain the `ThemeProvider`.

// This seems to be the most robust fix. I'll modify AppLayout and AppShell.
// `AppLayout` from the prompt is ALREADY async and passing props.
// Let's modify `AppShell` to receive it and contain ThemeProvider.

export function AppShellWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [companyName, setCompanyName] = React.useState("Toko Kilat");

  React.useEffect(() => {
    getCompanySettings().then(settings => {
      if (settings?.companyName) {
        setCompanyName(settings.companyName);
      }
    });
  }, []);

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
