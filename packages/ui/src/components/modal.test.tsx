import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Modal } from './modal';

afterEach(cleanup);

/** A modal opened from state (no Dialog.Trigger), like the review photo lightbox. */
function Opener({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open photo
      </button>
      <button type="button">Elsewhere</button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClosed?.();
        }}
        title="Review photo"
      >
        <p>Photo</p>
      </Modal>
    </>
  );
}

const opener = () => screen.getByRole('button', { name: 'Open photo' });

async function openFromKeyboard() {
  opener().focus();
  fireEvent.click(opener());
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })),
  );
}

describe('Modal', () => {
  it('gives focus back to the control that opened it when closed with Escape', async () => {
    render(<Opener />);
    await openFromKeyboard();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener()));
  });

  it('gives focus back when closed with its Close button', async () => {
    render(<Opener />);
    await openFromKeyboard();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener()));
  });

  it('leaves focus where the caller put it on close', async () => {
    const moveFocus = () => screen.getByRole('button', { name: 'Elsewhere' }).focus();
    render(<Opener onClosed={() => setTimeout(moveFocus)} />);
    await openFromKeyboard();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }));
  });
});
