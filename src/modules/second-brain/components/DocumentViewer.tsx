import { Image } from 'expo-image';
import { Platform, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { LoadingState } from '@/components/ui/States';
import { fileTypeFor } from '../fileTypes';
import type { DocumentItem } from '../types';
import { ViewerFallback } from './ViewerFallback';

function directoryOf(uri: string): string {
  return uri.slice(0, uri.lastIndexOf('/') + 1);
}

/**
 * Native viewer (iOS / Android).
 *  - Images (incl. HEIC/HEIF): expo-image, pinch-zoom on iOS.
 *  - PDF, Word, Excel on iOS: WKWebView renders them natively.
 *  - PDF/Office on Android: the system WebView can't render them → honest
 *    fallback with "Abrir con…" (system share sheet).
 */
export function DocumentViewer({ doc, uri }: { doc: DocumentItem; uri: string }) {
  const viewer = fileTypeFor(doc.name)?.viewer ?? 'external';

  if (viewer === 'image') {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        maximumZoomScale={5}
        minimumZoomScale={1}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri }} style={{ flex: 1, minHeight: 300 }} contentFit="contain" accessibilityLabel={doc.name} transition={150} />
      </ScrollView>
    );
  }

  if ((viewer === 'pdf' || viewer === 'office') && Platform.OS === 'ios') {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri }}
          originWhitelist={['*']}
          allowingReadAccessToURL={directoryOf(uri)}
          allowFileAccess
          startInLoadingState
          renderLoading={() => <LoadingState />}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          accessibilityLabel={doc.name}
        />
      </View>
    );
  }

  return <ViewerFallback doc={doc} uri={uri} reason={viewer === 'external' ? 'format' : 'platform'} />;
}
