import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { createServices, type Services } from './container';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ userId, children }: PropsWithChildren<{ userId: string }>) {
  const services = useMemo(() => createServices(userId), [userId]);
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used inside ServicesProvider');
  return ctx;
}
