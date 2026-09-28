import { parseSwellHeaders, requireString, validateUrl } from './context.js';
import type { HeaderReader } from './context.js';
import { SwellError } from './error.js';
import { USER_AGENT } from './version.js';

export interface StaffIdentity { userId: string; storeId: string }
export interface StaffOptions {
  headers: HeaderReader;
  method: string;
  /** Trusted app/iframe origin, never an unchecked forwarded-host value. */
  origin: string;
  cookies: { get(name: string): string | undefined };
}

/** Verifies store staff identity only. The application still owns authorization policy. */
export async function requireStaff({ headers, method, origin, cookies }: StaffOptions): Promise<StaffIdentity> {
  const { storeId, adminUrl } = parseSwellHeaders(headers);
  requireString(storeId, 'storeId');
  const url = validateUrl(adminUrl, 'adminUrl');
  requireString(method, 'method');
  if (method.toUpperCase() !== 'GET') {
    const expected = validateUrl(origin, 'origin');
    const supplied = headers.get('Origin');
    if (new URL(expected).origin !== origin) throw new Error('origin must be an absolute app origin');
    if (supplied !== origin || (headers.get('Sec-Fetch-Site') !== null && headers.get('Sec-Fetch-Site') !== 'same-origin')) {
      throw new SwellError('Staff request origin rejected', { status: 403 });
    }
  }
  const sessionId = cookies.get('_swell_admin_session');
  if (!sessionId) throw new SwellError('Staff session required', { status: 401 });
  const response = await fetch(new URL('/admin/api/session', url), {
    headers: { 'X-Session': sessionId, 'User-Agent': USER_AGENT }, redirect: 'manual',
  });
  if (response.status === 401 || response.status === 403) throw new SwellError('Invalid staff session', { status: 401 });
  if (!response.ok) throw new SwellError('Staff session verification failed', { status: response.status });
  const session = await response.json() as { user_id?: string; client_id?: string } | null;
  if (typeof session?.user_id !== 'string' || !session.user_id || session.client_id !== storeId) throw new SwellError('Invalid staff session', { status: 401 });
  return { userId: session.user_id, storeId };
}
