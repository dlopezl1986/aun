import type { IconName } from '@/components/ui/Icon';
import { featureFlags } from '@/config/featureFlags';
import type { KeyValueStore } from '@/storage/keyValueStore';
import { DemoEmailProvider } from './providers/demo';
import { GmailProvider } from './providers/gmail';
import { OutlookProvider } from './providers/outlook';
import type { EmailProvider, EmailProviderId } from './types';

export interface EmailProviderDescriptor {
  id: EmailProviderId;
  name: string;
  icon: IconName;
  color: string;
  /** Development-only providers are labelled as such in the UI. */
  devOnly?: boolean;
}

/** Display metadata. Adding Yahoo/IMAP = a descriptor + an `EmailProvider`. */
export const emailProviders: EmailProviderDescriptor[] = [
  { id: 'gmail', name: 'Gmail', icon: 'mail', color: '#EA4335' },
  { id: 'outlook', name: 'Outlook / Microsoft 365', icon: 'inbox', color: '#0A64AD' },
  ...(featureFlags.emailDemo ? [{ id: 'demo', name: 'Demo', icon: 'tool' as IconName, color: '#8E8E93', devOnly: true }] : []),
];

export const providerDescriptor = (id: EmailProviderId) =>
  emailProviders.find((p) => p.id === id) ?? { id, name: id, icon: 'mail' as IconName, color: '#8E8E93' };

export function createEmailProviders(store: KeyValueStore, userId: string): Map<EmailProviderId, EmailProvider> {
  const list: EmailProvider[] = [];
  if (featureFlags.emailGmail) list.push(new GmailProvider());
  if (featureFlags.emailOutlook) list.push(new OutlookProvider());
  if (featureFlags.emailDemo) list.push(new DemoEmailProvider(store, userId));
  return new Map(list.map((p) => [p.id, p]));
}
