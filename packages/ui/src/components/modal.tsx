'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** 'center' dialog or 'right' drawer (cart, filters). */
  placement?: 'center' | 'right';
  className?: string;
};

/** Accessible dialog/drawer: focus trap, Esc to close, focus restore (Radix). */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  placement = 'center',
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 data-[state=open]:animate-fade" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-white shadow-lift focus:outline-none',
            placement === 'center' &&
              'left-1/2 top-1/2 max-h-[90vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-card p-6 data-[state=open]:animate-rise',
            placement === 'right' &&
              'inset-y-0 right-0 w-[min(100vw,420px)] p-6 transition-transform duration-slow data-[state=open]:animate-fade',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl text-ink-900">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-ink-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="grid h-11 w-11 shrink-0 place-items-center rounded-pill text-ink-500 transition hover:bg-blush-50 hover:text-ink-900"
              aria-label="Close"
            >
              <X aria-hidden className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
