import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/services/ServicesProvider';
import { useDataQuery } from '@/state/queryClient';
import { getStorageProvider } from '@/storage/providers/factory';
import type { StorageProviderId } from '@/storage/providers/types';

/** Connection state of a storage provider (account label for Drive). */
export function useStorageConnection(id: StorageProviderId, enabled: boolean) {
  const { userId } = useServices();
  return useQuery({
    queryKey: ['u', userId, 'storage', 'connection', id],
    queryFn: () => getStorageProvider(id, userId).getConnection(),
    enabled,
    staleTime: 0,
  });
}

export function useDocumentsByProvider() {
  return useDataQuery('folders', ['byProvider'], (s) => s.secondBrain.countByProvider());
}

export function useRefreshStorage() {
  const client = useQueryClient();
  const { userId } = useServices();
  return () => client.invalidateQueries({ queryKey: ['u', userId, 'storage'] });
}
