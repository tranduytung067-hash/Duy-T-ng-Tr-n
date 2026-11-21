import { useEffect, useRef, type RefObject } from 'react';

/** Keep keyboard navigation inside an open drawer/dialog and return focus to
 * its trigger on close. The callback ref avoids restarting on parent renders. */
export function useDialogFocus(
  open: boolean,
  panel: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !panel.current) return;
    const element: HTMLDivElement = panel.current;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(element.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    )).filter(item => !item.hidden && item.getAttribute('aria-hidden') !== 'true' && item.getClientRects().length > 0);
    const focusFrame = requestAnimationFrame(() => (controls()[0] || element).focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          element.focus();
        } else if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    element.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      element.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, panel]);
}
