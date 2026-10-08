import { base64Decode, textToBase64Url, utf8Decode } from '@/utils/base64';
import { stripActiveContent, hasRemoteImages } from '../components/mailHtml';
import { decodeHeader, extractBodies } from '../providers/gmail';
import { htmlToText, parseAddressList, replyAllCc } from '../providers/http';
import { buildMime, encodeHeader, prefixSubject } from '../providers/mime';

describe('MIME helpers', () => {
  it('builds a UTF-8 message with encoded subject and base64 body', () => {
    const raw = buildMime({ to: [{ name: 'Laura', address: 'laura@example.com' }], subject: 'Cumpleaños', body: 'Tarta de chocolate ✓' });
    expect(raw).toContain('To: "Laura" <laura@example.com>\r\n');
    expect(raw).toContain(`Subject: ${encodeHeader('Cumpleaños')}\r\n`);
    const body = raw.split('\r\n\r\n')[1];
    expect(utf8Decode(base64Decode(body))).toBe('Tarta de chocolate ✓');
    expect(decodeHeader(encodeHeader('Cumpleaños'))).toBe('Cumpleaños');
  });

  it('decodes Q-encoded latin-1 headers', () => {
    expect(decodeHeader('=?ISO-8859-1?Q?Excursi=F3n_al_museo?=')).toBe('Excursión al museo');
  });

  it('does not stack Re:/Fwd: prefixes', () => {
    expect(prefixSubject('Re', 'Hola')).toBe('Re: Hola');
    expect(prefixSubject('Re', 'RE: Hola')).toBe('RE: Hola');
    expect(prefixSubject('Fwd', 'Fw: Hola')).toBe('Fw: Hola');
  });

  it('parses address lists with names, quotes and separators', () => {
    expect(parseAddressList('"Pérez, Ana" <ana@x.com>; bob@y.com, Luis <luis@z.com>')).toEqual([
      { name: 'Pérez, Ana', address: 'ana@x.com' },
      { address: 'bob@y.com' },
      { name: 'Luis', address: 'luis@z.com' },
    ]);
  });

  it('reply-all excludes me and the sender, without duplicates', () => {
    const original = {
      from: { address: 'laura@example.com' },
      to: [{ address: 'ME@aun.test' }, { address: 'abuela@example.com' }],
      cc: [{ address: 'abuela@example.com' }, { address: 'laura@example.com' }],
    };
    expect(replyAllCc(original, 'me@aun.test')).toEqual([{ address: 'abuela@example.com' }]);
  });

  it('extracts html, text and attachments from a Gmail MIME tree', () => {
    const b64 = (s: string) => textToBase64Url(s);
    const bodies = extractBodies({
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64('Hola ñ') } },
            { mimeType: 'text/html', body: { data: b64('<p>Hola <b>ñ</b></p>') } },
          ],
        },
        { mimeType: 'application/pdf', filename: 'autorizacion.pdf', body: { attachmentId: 'a1', size: 1200 } },
      ],
    });
    expect(bodies.text).toBe('Hola ñ');
    expect(bodies.html).toBe('<p>Hola <b>ñ</b></p>');
    expect(bodies.attachments).toEqual([{ name: 'autorizacion.pdf', mimeType: 'application/pdf', size: 1200 }]);
  });
});

describe('HTML safety', () => {
  it('removes scripts, frames, forms, handlers and javascript: URLs', () => {
    const dirty =
      '<p onclick="steal()">Hi</p><script>alert(1)</script><iframe src="x"></iframe><form action="y"><input></form><a href="javascript:alert(1)">x</a><img src="a.png" onerror="x()">';
    const clean = stripActiveContent(dirty);
    expect(clean).not.toMatch(/script|iframe|<form|onclick|onerror|javascript:/i);
    expect(clean).toContain('<p>Hi</p>');
  });

  it('detects remote images and converts html to text', () => {
    expect(hasRemoteImages('<img src="https://t.example/pixel.gif">')).toBe(true);
    expect(hasRemoteImages('<img src="data:image/png;base64,AAA">')).toBe(false);
    expect(htmlToText('<p>Uno</p><p>Dos &amp; tres</p><style>p{}</style>')).toBe('Uno\nDos & tres');
  });
});
