/**
 * Wraps an e-mail's HTML in a locked-down document:
 *  - CSP `default-src 'none'`: no scripts, no frames, no forms, no fetches.
 *  - Remote images are blocked unless the user allows them (tracking pixels
 *    reveal when/where a mail is opened). `data:`/`cid:` images always show.
 *  - Links open outside the app (`target=_blank`).
 * Mail is rendered on white like most clients: senders design for it.
 */
export function buildMailDocument(html: string, opts: { allowRemoteImages: boolean; linkColor: string }): string {
  const img = opts.allowRemoteImages ? 'img-src data: cid: https: http:' : 'img-src data: cid:';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; ${img}">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#1c1c1e}
  body{padding:16px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
  img{max-width:100%;height:auto}
  table{max-width:100%}
  a{color:${opts.linkColor}}
  pre{white-space:pre-wrap}
</style></head><body>${stripActiveContent(html)}</body></html>`;
}

/** Defence in depth on top of the CSP: drop scripts, frames, forms and inline handlers. */
export function stripActiveContent(html: string): string {
  return (
    html
      // Active elements go with their content…
      .replace(/<(script|iframe|object|embed|applet)\b[\s\S]*?<\/\1\s*>/gi, '')
      // …and any leftover/unpaired or form-related tag is dropped (its text stays).
      .replace(
        /<\/?(script|iframe|object|embed|applet|form|input|button|textarea|select|option|meta|link|base|frame|frameset)\b[^>]*>/gi,
        '',
      )
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src|action|formaction)\s*=\s*("|')\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, '$1="#"')
  );
}

/** Whether the HTML references remote images (to offer "Mostrar imágenes"). */
export const hasRemoteImages = (html: string) => /<img[^>]+src\s*=\s*["']?https?:/i.test(html) || /url\(\s*["']?https?:/i.test(html);
