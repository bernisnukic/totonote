import { useCallback, useRef, useEffect } from 'react';

interface UsePanelResizeOptions {
  minWidth: number;
  maxWidth: number;
  onResize: (width: number) => void;
  direction?: 'left' | 'right';
}

export function usePanelResize({ minWidth, maxWidth, onResize, direction = 'right' }: UsePanelResizeOptions) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent, currentWidth: number) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = currentWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = direction === 'right'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth, onResize, direction]);

  return { onMouseDown, isDragging: isDragging.current };
}
