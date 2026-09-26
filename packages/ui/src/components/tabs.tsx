'use client';

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';

export type TabItem = {
  id: string;
  label: string;
  /**
   * Optional URL for this tab (e.g. "?method=otp"). Tabs then render as links, so switching
   * works without JavaScript (the server renders the chosen tab); with JavaScript the switch is
   * instant and the URL is updated in place.
   */
  href?: string;
  content: ReactNode;
};

type TabsProps = {
  /** Accessible name of the tab list, e.g. "Log in with". */
  label: string;
  items: TabItem[];
  /** Initially selected tab id (defaults to the first). */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
};

/** WAI-ARIA tabs: arrow keys / Home / End move between tabs, panels are labelled by their tab. */
export function Tabs({ label, items, defaultValue, onValueChange, className }: TabsProps) {
  const baseId = useId();
  const [current, setCurrent] = useState(defaultValue ?? items[0]?.id);
  const tabRefs = useRef(new Map<string, HTMLElement>());

  function select(id: string, focus = false) {
    setCurrent(id);
    onValueChange?.(id);
    const href = items.find((i) => i.id === id)?.href;
    if (href) window.history.replaceState(window.history.state, '', href);
    if (focus) tabRefs.current.get(id)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>, index: number) {
    const last = items.length - 1;
    const target =
      e.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : e.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    const item = target === null ? undefined : items[target];
    if (!item) return;
    e.preventDefault();
    select(item.id, true);
  }

  function onLinkClick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    select(id);
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-pill bg-blush-50 p-1"
      >
        {items.map((item, index) => {
          const selected = item.id === current;
          const props = {
            id: `${baseId}-tab-${item.id}`,
            role: 'tab',
            'aria-selected': selected,
            'aria-controls': `${baseId}-panel-${item.id}`,
            tabIndex: selected ? 0 : -1,
            onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, index),
            className: cn(
              'inline-flex min-h-11 items-center justify-center rounded-pill px-4 text-sm font-medium transition duration-fast',
              selected ? 'bg-white text-pink-700 shadow-soft' : 'text-ink-500 hover:text-ink-900',
            ),
          } as const;
          const setRef = (el: HTMLElement | null) => {
            if (el) tabRefs.current.set(item.id, el);
            else tabRefs.current.delete(item.id);
          };
          return item.href ? (
            <a
              key={item.id}
              ref={setRef}
              href={item.href}
              onClick={(e) => onLinkClick(e, item.id)}
              {...props}
            >
              {item.label}
            </a>
          ) : (
            <button
              key={item.id}
              ref={setRef}
              type="button"
              onClick={() => select(item.id)}
              {...props}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== current}
          className="pt-6 focus-visible:outline-none"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
