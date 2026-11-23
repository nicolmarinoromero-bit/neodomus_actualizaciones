import { useEffect, useRef, useState } from 'react';

export function useOutsideDismiss<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<T | null>(null);

  useEffect(() => {
    const closeWhenOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeWhenOutside);
    return () => document.removeEventListener('mousedown', closeWhenOutside);
  }, []);

  return { open, setOpen, rootRef };
}
