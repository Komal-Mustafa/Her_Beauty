// Server-compatible (no hooks): pages render it with the sessions they loaded.
import type { SessionInfo } from '@hb/types';
import { Alert, Badge } from '@hb/ui';
import type { DoneState } from '../results';
import { RevokeSessionButton } from './session-controls';
import type { FormAction } from './types';
import { describeUserAgent, formatDateTime } from './user-agent';

const APP_NAMES: Record<SessionInfo['audience'], string> = {
  web: 'Shop',
  seller: 'Seller portal',
  admin: 'Admin',
};

/**
 * "Where you're signed in": one row per active session, "Sign out" on every device but this one.
 * `sessions` is null when they could not be loaded (shown as a warning, never as "none").
 */
export function SessionList({
  sessions,
  revokeAction,
}: {
  sessions: SessionInfo[] | null;
  revokeAction: FormAction<DoneState>;
}) {
  if (!sessions) {
    return (
      <Alert tone="warning">
        We couldn’t load your devices just now. Refresh the page to try again.
      </Alert>
    );
  }
  return (
    <ul className="divide-y divide-ink-200">
      {sessions.map((s) => {
        const device = describeUserAgent(s.userAgent);
        return (
          <li key={s.id} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                {device}
                {s.current && <Badge kind="success">This device</Badge>}
              </p>
              <p className="break-words text-sm text-ink-500">
                {APP_NAMES[s.audience]} · Last active {formatDateTime(s.lastUsedAt ?? s.createdAt)}
                {s.ip ? ` · ${s.ip}` : ''}
              </p>
            </div>
            {!s.current && <RevokeSessionButton id={s.id} device={device} action={revokeAction} />}
          </li>
        );
      })}
    </ul>
  );
}
