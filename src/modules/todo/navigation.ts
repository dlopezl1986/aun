import { router } from 'expo-router';

/** Opens a task's detail editor from anywhere (search, dashboard, links). */
export const openTodoTask = (id: string) => router.navigate({ pathname: '/todo', params: { task: id } });
