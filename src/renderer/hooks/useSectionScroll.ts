import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../stores';

export function useSectionScroll(
  editorContainerRef: React.RefObject<HTMLElement | null>,
  scrollingByClickRef: React.RefObject<boolean>
) {
  const setActiveSection = useStore(s => s.setActiveSection);
  const sections = useStore(s => s.sections);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || sections.length === 0) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Don't override tab clicks
        if (scrollingByClickRef.current) return;

        let maxRatio = 0;
        let visibleSectionId: string | null = null;

        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            visibleSectionId = (entry.target as HTMLElement).dataset.sectionId || null;
          }
        }

        if (visibleSectionId) {
          setActiveSection(visibleSectionId);
        }
      },
      {
        root: container,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    const sectionElements = container.querySelectorAll('[data-section-id]');
    sectionElements.forEach(el => observerRef.current!.observe(el));

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [editorContainerRef, setActiveSection, sections, scrollingByClickRef]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      if (!editorContainerRef.current) return;
      const el = editorContainerRef.current.querySelector(`[data-section-id="${sectionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [editorContainerRef]
  );

  return { scrollToSection };
}
