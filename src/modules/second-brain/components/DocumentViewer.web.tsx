import { createElement } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { fileTypeFor } from '../fileTypes';
import type { DocumentItem } from '../types';
import { ViewerFallback } from './ViewerFallback';

/** Browsers can't decode HEIC/HEIF (only Safari partially): treat as not viewable. */
const BROWSER_UNSUPPORTED_IMAGES = new Set(['heic', 'heif']);

/**
 * Web viewer.
 *  - Images: native <img> (object-fit: contain).
 *  - PDF: the browser's built-in PDF viewer in an <iframe>.
 *  - Word/Excel/HEIC: not renderable by browsers → download fallback.
 */
export function DocumentViewer({ doc, uri }: { doc: DocumentItem; uri: string }) {
  const { colors, radius } = useTheme();
  const viewer = fileTypeFor(doc.name)?.viewer ?? 'external';

  if (viewer === 'image' && !BROWSER_UNSUPPORTED_IMAGES.has(doc.extension)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {createElement('img', {
          src: uri,
          alt: doc.name,
          style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: radius.md },
        })}
      </View>
    );
  }

  if (viewer === 'pdf') {
    return createElement('iframe', {
      src: uri,
      title: doc.name,
      style: {
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 480,
        border: 0,
        borderRadius: radius.md,
        background: colors.surfaceMuted,
      },
    });
  }

  return <ViewerFallback doc={doc} uri={uri} reason={viewer === 'image' ? 'browser' : viewer === 'external' ? 'format' : 'platform'} />;
}
