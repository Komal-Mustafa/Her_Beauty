import { RotateCcw, ShieldCheck, BadgeCheck } from 'lucide-react';
import { cn } from '../lib/cn';

const ITEMS = [
  { icon: ShieldCheck, title: 'Payment protected', body: 'Held safely until your parcel arrives' },
  { icon: BadgeCheck, title: 'Verified sellers', body: 'Every shop and brand is checked' },
  { icon: RotateCcw, title: 'Easy returns', body: '7-day return window' },
] as const;

/** 04-ui-ux §5: 3 icons in gold-600. */
export function TrustStrip({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <ul className={cn('grid gap-4', compact ? 'grid-cols-1' : 'sm:grid-cols-3', className)}>
      {ITEMS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-gold-600" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-ink-900">{title}</p>
            {!compact && <p className="text-sm text-ink-500">{body}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
