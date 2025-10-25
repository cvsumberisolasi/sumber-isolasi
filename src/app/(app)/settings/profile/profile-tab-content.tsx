
'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsForm } from '../settings-form';
import { CompanySettings } from '../actions';


export function ProfileTabContent({ settings }: { settings: CompanySettings }) {
  return (
     <Card>
      <CardHeader>
        <CardTitle className="font-headline">Profil Perusahaan</CardTitle>
        <CardDescription>
          Atur informasi dasar mengenai usaha Anda. Informasi ini akan digunakan pada struk dan laporan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingsForm initialData={settings} />
      </CardContent>
    </Card>
  )
}
