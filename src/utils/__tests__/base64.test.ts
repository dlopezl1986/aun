import { base64Decode, base64Encode, base64UrlToText, textToBase64Url, utf8Decode, utf8Encode } from '../base64';

describe('base64 / utf8', () => {
  it('round-trips accents, ñ and emoji', () => {
    const text = 'Cumpleaños de Elisa 🎂 — ¿parque o casa?';
    expect(utf8Decode(utf8Encode(text))).toBe(text);
    expect(base64UrlToText(textToBase64Url(text))).toBe(text);
  });

  it('matches the standard encoding', () => {
    expect(base64Encode(utf8Encode('Hola'))).toBe('SG9sYQ==');
    expect(base64Encode(utf8Encode('ñ'))).toBe('w7E=');
    expect(utf8Decode(base64Decode('w7E='))).toBe('ñ');
    expect(textToBase64Url('??>')).toBe('Pz8-');
  });
});
