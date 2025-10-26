
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';

function generateBreadcrumbs(pathname: string) {
    const pathSegments = pathname.split('/').filter(segment => segment);
    const breadcrumbs = pathSegments.map((segment, index) => {
        const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
        const label = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const isLast = index === pathSegments.length - 1;
        return { href, label, isLast };
    });

    if (breadcrumbs.length > 0) {
        return [{ href: '/dashboard', label: 'Dashboard', isLast: false }, ...breadcrumbs];
    }
    
    return [{ href: '/dashboard', label: 'Dashboard', isLast: true }];
}

export function AppHeader() {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <header
      className={cn(
        'hidden sm:flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6'
      )}
    >
        <Breadcrumb>
            <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={`${crumb.href}-${index}`}>
                        <BreadcrumbItem>
                            {crumb.isLast ? (
                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                        {!crumb.isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                ))}
            </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
