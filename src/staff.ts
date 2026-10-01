import type { SwellRequestContext } from './request-context.js';
import { SwellError } from './error.js';

export interface StaffIdentity { readonly userId: string; readonly storeId: string }

/** Identity only; any dashboard role counts. The proxy owns write-origin checks; the app owns permissions. */
export function requireStaff(context: SwellRequestContext): StaffIdentity {
  if (!context.staff) throw new SwellError('Staff identity required', { status: 401, code: 'staff_required' });
  return context.staff;
}
