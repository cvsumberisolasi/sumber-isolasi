
import React from 'react';
import { getCompanySettings } from '../actions';
import { ProfileTabContent } from './profile-tab-content';


export default async function SettingsPageContent() {
  const settings = await getCompanySettings();

  return (
    <ProfileTabContent settings={settings} />
  );
}
