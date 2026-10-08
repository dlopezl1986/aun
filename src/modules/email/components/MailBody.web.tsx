import { createElement, useState } from 'react';

import { useTheme } from '@/theme';
import { buildMailDocument } from './mailHtml';

/**
 * Web: sandboxed iframe WITHOUT `allow-scripts` (so `allow-same-origin` is safe
 * and only used to measure the content height). Links open in a new tab.
 */
export function MailBody({ html, allowRemoteImages, title }: { html: string; allowRemoteImages: boolean; title: string }) {
  const { colors, radius } = useTheme();
  const [height, setHeight] = useState(240);
  const doc = buildMailDocument(html, { allowRemoteImages, linkColor: colors.primary });
  return createElement('iframe', {
    title,
    srcDoc: doc,
    sandbox: 'allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    referrerPolicy: 'no-referrer',
    onLoad: (e: { currentTarget: HTMLIFrameElement }) => {
      const body = e.currentTarget.contentDocument?.body;
      if (body) setHeight(Math.min(Math.max(body.scrollHeight + 8, 120), 4000));
    },
    style: { width: '100%', height, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: '#fff' },
  });
}
