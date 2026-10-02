import type { SwellRequestContext } from './request-context.js';
import { SwellError } from './error.js';

export interface StoreUser { readonly userId: string; readonly storeId: string }

/** Identity only; any dashboard role counts. The proxy owns write-origin checks; the app owns permissions. */
export function requireStoreUser(context: SwellRequestContext): StoreUser {
  if (!context.storeUser) throw new SwellError('Store user required', { status: 401, code: 'store_user_required' });
  return context.storeUser;
}
