import * as Linking from 'expo-linking';
import { useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/theme';
import { buildMailDocument } from './mailHtml';

/**
 * iOS/Android: WebView with JavaScript disabled. Any navigation (a tapped
 * link) is handed to the system browser instead of loading inside the app.
 */
export function MailBody({ html, allowRemoteImages, title }: { html: string; allowRemoteImages: boolean; title: string }) {
  const { colors, radius } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <View
      accessibilityLabel={title}
      style={{ height: Math.round(height * 0.6), borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
    >
      <WebView
        originWhitelist={['about:*', 'data:*']}
        source={{ html: buildMailDocument(html, { allowRemoteImages, linkColor: colors.primary }) }}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith('about:') || req.url.startsWith('data:')) return true;
          if (/^(https?|mailto|tel):/i.test(req.url)) void Linking.openURL(req.url);
          return false;
        }}
        style={{ backgroundColor: '#fff' }}
      />
    </View>
  );
}
