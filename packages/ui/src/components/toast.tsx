'use client';

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';

type ToastTone = 'success' | 'warning' | 'danger' | 'info';
type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  /** One follow-up action, e.g. the app's `<Link href="/cart">View cart</Link>`. */
  action?: ReactNode;
};
type ToastApi = { show: (t: Omit<ToastItem, 'id'>) => void };

const ToastContext = createContext<ToastApi | null>(null);
const AUTO_HIDE_MS = 5000; // 04-ui-ux §5

const ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
} as const;
const BAR = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;
const TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismiss(id), AUTO_HIDE_MS);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-3"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-btn bg-white p-4 pl-5 shadow-lift animate-rise"
            >
              <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', BAR[t.tone])} />
              <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', TEXT[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-ink-500">{t.body}</p>}
                {t.action && (
                  <div className="-mb-2 mt-1 text-sm font-medium text-pink-600 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:underline-offset-4 [&_a:hover]:text-pink-700 [&_a:hover]:underline">
                    {t.action}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-m-1 grid h-8 w-8 place-items-center rounded-pill text-ink-500 hover:bg-blush-50"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
