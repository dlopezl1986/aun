import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/feedback/ToastProvider';
import { useServices } from '@/services/ServicesProvider';
import type { Services } from '@/services/container';

/**
 * TanStack Query manages async domain data (cache, loading/error states,
 * invalidation). Today the source is local repositories; tomorrow a backend —
 * the hooks stay the same.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
});

/** Domain scopes used as query keys; mutations invalidate whole scopes. */
export type DataScope =
  'calendars' | 'events' | 'tasks' | 'folders' | 'family' | 'shopping' | 'email' | 'notifications' | 'storage' | 'sharing';

export function useDataQuery<T>(scope: DataScope, key: unknown[], fn: (s: Services) => Promise<T>) {
  const services = useServices();
  return useQuery({ queryKey: ['u', services.userId, scope, ...key], queryFn: () => fn(services) });
}

interface MutationOptions<R> {
  invalidate: DataScope[];
  successMessage?: string | ((result: R) => string);
  errorMessage?: string | ((error: unknown) => string);
  /** Extra side effect with the result (e.g. a warning about partial failures). */
  onResult?: (result: R) => void;
}

export function useDataMutation<V, R>(fn: (s: Services, vars: V) => Promise<R>, options: MutationOptions<R>) {
  const services = useServices();
  const client = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (vars: V) => fn(services, vars),
    onSuccess: async (result) => {
      await Promise.all(options.invalidate.map((scope) => client.invalidateQueries({ queryKey: ['u', services.userId, scope] })));
      // Alerts are derived from every module's data: refresh them after any change.
      void client.invalidateQueries({ queryKey: ['u', services.userId, 'alerts'] });
      const msg = typeof options.successMessage === 'function' ? options.successMessage(result) : options.successMessage;
      if (msg) toast.show(msg, 'success');
      options.onResult?.(result);
    },
    onError: (error) => {
      const msg = typeof options.errorMessage === 'function' ? options.errorMessage(error) : options.errorMessage;
      // An empty string means "handled silently" (e.g. background mark-as-read).
      if (msg !== '') toast.show(msg ?? t('common.errorDescription'), 'error');
    },
  });
}
