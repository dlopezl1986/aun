import { SupabaseClient } from '@/services/backend/supabase';
import { memoryStore } from '@/test/memoryStore';
import { SupabaseAuthGateway } from '../supabaseAuthGateway';

function respond(status: number, body: unknown) {
  globalThis.fetch = jest.fn(
    async () => ({ ok: status < 300, status, statusText: '', text: async () => JSON.stringify(body) }) as Response,
  ) as typeof fetch;
}

function setup() {
  const secure = { ...memoryStore(), isPersistent: true };
  const client = new SupabaseClient({ url: 'https://x.supabase.co', anonKey: 'anon' }, secure);
  return { gateway: new SupabaseAuthGateway(client, ['google']), secure };
}

describe('SupabaseAuthGateway', () => {
  it('signs in and stores the session in the secure store', async () => {
    const { gateway, secure } = setup();
    respond(200, {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
      user: { id: 'u1', email: 'ana@x.com', user_metadata: { display_name: 'Ana' }, app_metadata: { providers: ['email', 'google'] } },
    });
    const s = await gateway.signInWithPassword({ email: ' ANA@x.com ', password: 'secret123' });
    expect(s.user).toMatchObject({ id: 'u1', displayName: 'Ana', methods: ['password', 'google'] });
    expect(JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ email: 'ana@x.com', password: 'secret123' });
    expect(await secure.getItem('aun.backend.session')).toContain('"refreshToken":"r"');
    expect(gateway.getAvailability().find((a) => a.method === 'google')?.available).toBe(true);
    expect(gateway.getAvailability().find((a) => a.method === 'apple')?.available).toBe(false);
  });

  it('maps backend errors to AUN error codes', async () => {
    const { gateway } = setup();
    respond(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    await expect(gateway.signInWithPassword({ email: 'a@x.com', password: 'bad' })).rejects.toMatchObject({ code: 'invalid-credentials' });
    respond(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
    await expect(gateway.signInWithPassword({ email: 'a@x.com', password: 'x' })).rejects.toMatchObject({ code: 'email-not-confirmed' });
    // Email confirmation enabled: sign-up returns the user without a session.
    respond(200, { id: 'u2', email: 'b@x.com' });
    await expect(gateway.signUpWithPassword({ email: 'b@x.com', password: 'secret123', displayName: 'B' })).rejects.toMatchObject({
      code: 'confirmation-sent',
    });
    globalThis.fetch = jest.fn(async () => Promise.reject(new Error('down'))) as typeof fetch;
    await expect(gateway.signInWithPassword({ email: 'a@x.com', password: 'x' })).rejects.toMatchObject({ code: 'network' });
  });
});
