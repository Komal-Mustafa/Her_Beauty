'use client';

import { Button, cn } from '@hb/ui';
import { useEffect, useState } from 'react';

/**
 * The 10 backup codes (shown once) with Copy and Download. While the list is on screen, leaving
 * or reloading the page asks for confirmation first: the codes cannot be shown again.
 */
export function BackupCodeList({
  codes,
  fileTitle = 'Her Beauty backup codes',
  fileName = 'her-beauty-backup-codes.txt',
  className,
}: {
  codes: string[];
  fileTitle?: string;
  fileName?: string;
  className?: string;
}) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const text = `${fileTitle} (each works once)\n\n${codes.join('\n')}\n`;

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(text);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  function downloadCodes() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn('space-y-4', className)}>
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-btn border border-gold-500 bg-blush-50 p-4 text-sm font-medium tabular-nums tracking-wider text-ink-900"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={copyCodes}
        >
          Copy codes
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={downloadCodes}
        >
          Download codes
        </Button>
        <p role="status" className="text-sm text-ink-500">
          {copy === 'copied' && 'Copied.'}
          {copy === 'failed' && 'Couldn’t copy. Select the codes and copy them instead.'}
        </p>
      </div>
    </div>
  );
}
