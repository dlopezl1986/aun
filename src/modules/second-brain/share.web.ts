/** Web: triggers a real browser download of the (blob) URI with the document name. */
export async function exportFile(uri: string, _mimeType: string, name: string): Promise<boolean> {
  const a = document.createElement('a');
  a.href = uri;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export const exportMode: 'share' | 'download' = 'download';
