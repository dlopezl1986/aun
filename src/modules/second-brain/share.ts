import * as Sharing from 'expo-sharing';

/**
 * iOS/Android: opens the system share sheet ("Guardar en Archivos",
 * "Abrir con…", AirDrop, Drive…). Returns false when sharing isn't available.
 */
export async function exportFile(uri: string, mimeType: string, name: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: name });
  return true;
}

/** Native platforms show "Compartir / Abrir con…" rather than a download. */
export const exportMode: 'share' | 'download' = 'share';
