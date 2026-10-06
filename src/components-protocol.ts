export const PROTOCOL = 'swell:component';
/**
 * Protocol evolution: changes within version 1 are additive. Both sides ignore message types and
 * fields they do not know, so new messages and fields need no version change. A breaking change
 * (a removed or renamed message or field, or a changed meaning) needs a new version.
 */
export const PROTOCOL_VERSION = 1;
export const TOKEN_HEADER = 'Swell-Component-Token';

/** Placeholder position in the host viewport. */
export interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

/** Component props as sent over postMessage: data only. */
export interface WireProps {
  value: unknown;
  context: unknown;
  params: Record<string, unknown>;
  settings: Record<string, unknown>;
  locale: string;
  readonly: boolean;
}

export type HostMessage =
  | { type: 'init'; props: WireProps; token: string | null }
  | { type: 'update'; props: Partial<WireProps> }
  | { type: 'token'; token: string | null }
  | { type: 'event'; call: number; name: string; data: unknown }
  | { type: 'rect'; rect: Rect }
  | { type: 'focus'; edge: 'first' | 'last' };

export type FrameMessage =
  | { type: 'hello' }
  | { type: 'ready' }
  | { type: 'change'; value: unknown }
  | { type: 'validity'; error: string | null }
  | { type: 'resize'; height: number }
  | { type: 'overlay'; on: boolean }
  | { type: 'result'; call: number; result?: unknown; error?: string }
  | { type: 'error'; message: string }
  | { type: 'focus-exit'; direction: 'next' | 'previous' };

interface Envelope {
  $swell: typeof PROTOCOL;
  v: number;
  channel: string;
}

export function wrap<T extends HostMessage | FrameMessage>(channel: string, message: T): T & Envelope {
  return { ...message, $swell: PROTOCOL, v: PROTOCOL_VERSION, channel };
}

/** The message when it belongs to this protocol version and channel, otherwise null. */
export function unwrap<T extends HostMessage | FrameMessage>(data: unknown, channel: string): T | null {
  if (!data || typeof data !== 'object') return null;
  const envelope = data as Partial<Envelope> & { type?: unknown };
  if (envelope.$swell !== PROTOCOL || envelope.v !== PROTOCOL_VERSION || envelope.channel !== channel || typeof envelope.type !== 'string') return null;
  return data as T;
}
