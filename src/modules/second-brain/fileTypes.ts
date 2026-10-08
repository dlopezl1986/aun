import type { IconName } from '@/components/ui/Icon';

/**
 * Supported document formats (section 14) and how each is viewed (section 16).
 * Adding a format = adding an entry here (+ a viewer if it's a new kind).
 */
export type ViewerKind = 'pdf' | 'image' | 'office' | 'external';

export interface FileTypeDefinition {
  extensions: string[];
  mimeTypes: string[];
  labelKey: string;
  icon: IconName;
  viewer: ViewerKind;
}

export const fileTypes: FileTypeDefinition[] = [
  { extensions: ['pdf'], mimeTypes: ['application/pdf'], labelKey: 'secondBrain.types.pdf', icon: 'file-text', viewer: 'pdf' },
  {
    extensions: ['png', 'jpg', 'jpeg', 'heic', 'heif', 'webp', 'gif'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/heic', 'image/heif', 'image/webp', 'image/gif'],
    labelKey: 'secondBrain.types.image',
    icon: 'image',
    viewer: 'image',
  },
  {
    extensions: ['doc', 'docx'],
    mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    labelKey: 'secondBrain.types.word',
    icon: 'file-text',
    viewer: 'office',
  },
  {
    extensions: ['xls', 'xlsx'],
    mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    labelKey: 'secondBrain.types.excel',
    icon: 'grid',
    viewer: 'office',
  },
];

export function fileTypeFor(nameOrExt: string): FileTypeDefinition | undefined {
  const ext = nameOrExt.includes('.') ? nameOrExt.split('.').pop()!.toLowerCase() : nameOrExt.toLowerCase();
  return fileTypes.find((f) => f.extensions.includes(ext));
}

export const supportedExtensions = fileTypes.flatMap((f) => f.extensions);
