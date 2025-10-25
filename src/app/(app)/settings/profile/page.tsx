
'use client';

import React, { useState, useEffect } from 'react';
import { getCompanySettings, type CompanySettings } from '../actions';
import { ProfileTabContent } from './profile-tab-content';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPageContent() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompanySettings().then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    );
  }

  return (
    <ProfileTabContent settings={settings || {}} />
  );
}
