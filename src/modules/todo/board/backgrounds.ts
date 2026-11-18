import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useServices } from '@/services/ServicesProvider';
import { asyncKeyValueStore, storageKeys } from '@/storage/keyValueStore';
import { useUpdateProject } from '../hooks';
import type { Project } from '../types';
import { GENERAL_BOARD } from './model';

/**
 * Board wallpapers (Trello-like backgrounds). The presets are illustrations
 * bundled with the app (they work offline); you can also use your own photo,
 * stored as a small JPEG so it syncs with the board.
 */
export const WALLPAPERS = [
  { id: 'lavanda', source: require('../../../../assets/boards/lavanda.jpg'), dark: false },
  { id: 'atardecer', source: require('../../../../assets/boards/atardecer.jpg'), dark: true },
  { id: 'oceano', source: require('../../../../assets/boards/oceano.jpg'), dark: true },
  { id: 'bosque', source: require('../../../../assets/boards/bosque.jpg'), dark: false },
  { id: 'dunas', source: require('../../../../assets/boards/dunas.jpg'), dark: false },
  { id: 'aurora', source: require('../../../../assets/boards/aurora.jpg'), dark: true },
  { id: 'menta', source: require('../../../../assets/boards/menta.jpg'), dark: false },
  { id: 'melocoton', source: require('../../../../assets/boards/melocoton.jpg'), dark: false },
  { id: 'noche', source: require('../../../../assets/boards/noche.jpg'), dark: true },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]['id'];

const DEFAULT_GENERAL: WallpaperId = 'lavanda';

/** A board without a chosen background still gets a wallpaper (never a flat colour). */
export function defaultBackground(boardId: string): string {
  if (boardId === GENERAL_BOARD) return `wp:${DEFAULT_GENERAL}`;
  let h = 0;
  for (const ch of boardId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `wp:${WALLPAPERS[h % WALLPAPERS.length].id}`;
}

export interface ResolvedBackground {
  source: any;
  /** Dark images get light text on top (and vice versa). */
  dark: boolean;
}

export function resolveBackground(value: string | null | undefined, boardId: string): ResolvedBackground {
  const v = value || defaultBackground(boardId);
  if (v.startsWith('data:image/')) return { source: { uri: v }, dark: true };
  const wp = WALLPAPERS.find((w) => `wp:${w.id}` === v) ?? WALLPAPERS.find((w) => `wp:${w.id}` === defaultBackground(boardId))!;
  return { source: wp.source, dark: wp.dark };
}

/** Picks a photo and shrinks it to a light, synced JPEG (data URI). */
export async function pickBackgroundPhoto(): Promise<string | 'denied' | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return 'denied';
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const width = Math.min(a.width || 1280, 1280);
  const out = await manipulateAsync(a.uri, [{ resize: { width } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('No image data');
  return `data:image/jpeg;base64,${out.base64}`;
}

/**
 * Background of a board. Projects keep it on the project (synced); the
 * General board has no project, so it is kept on this device for this account.
 */
export function useBoardBackground(boardId: string, project: Project | undefined) {
  const services = useServices();
  const update = useUpdateProject();
  const key = storageKeys.user(services.userId ?? 'anon', 'todo:generalBackground');
  const [general, setGeneral] = useState<string | null>(null);
  useEffect(() => {
    if (boardId !== GENERAL_BOARD) return;
    asyncKeyValueStore
      .getItem(key)
      .then(setGeneral)
      .catch(() => undefined);
  }, [boardId, key]);

  const value = boardId === GENERAL_BOARD ? general : (project?.background ?? null);
  const set = (next: string | null) => {
    if (boardId === GENERAL_BOARD) {
      setGeneral(next);
      void (next ? asyncKeyValueStore.setItem(key, next) : asyncKeyValueStore.removeItem(key)).catch(() => undefined);
    } else if (project) update.mutate({ id: project.id, patch: { background: next } });
  };
  return { value, background: resolveBackground(value, boardId), set };
}
