import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../../stores';
import { useSectionScroll } from '../../hooks/useSectionScroll';
import { MainToolbar } from '../toolbar/MainToolbar';
import { SectionTabBar } from '../section-tabs/SectionTabBar';
import { SectionEditor } from './SectionEditor';
import { SectionTagBar } from './SectionTagBar';
import { TagPopover } from './TagPopover';
import { SelectionToolbar } from './SelectionToolbar';
import { FilteredView } from './FilteredView';

export function EditorArea() {
  const sections = useStore(s => s.sections);
  const activeSectionId = useStore(s => s.activeSectionId);
  const setActiveSection = useStore(s => s.setActiveSection);
  const loadTags = useStore(s => s.loadTags);
  const loadCategories = useStore(s => s.loadCategories);
  const loadCategoryRules = useStore(s => s.loadCategoryRules);
  const activeDocument = useStore(s => s.activeDocument);
  const sectionTags = useStore(s => s.sectionTags);
  const loadSectionTagsByDocument = useStore(s => s.loadSectionTagsByDocument);
  const documentAnnotations = useStore(s => s.documentAnnotations);
  const loadDocumentAnnotations = useStore(s => s.loadDocumentAnnotations);
  const activeFilters = useStore(s => s.activeFilters);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const scrollingByClickRef = useRef(false);

  const { scrollToSection } = useSectionScroll(editorContainerRef, scrollingByClickRef);

  // Load tags, categories and their rules when editor mounts
  useEffect(() => {
    loadTags();
    loadCategories();
    loadCategoryRules();
  }, [loadTags, loadCategories, loadCategoryRules]);

  // Load section tags and document annotations when document changes
  useEffect(() => {
    if (activeDocument?.id) {
      loadSectionTagsByDocument(activeDocument.id);
      loadDocumentAnnotations(activeDocument.id);
    }
  }, [activeDocument?.id, loadSectionTagsByDocument, loadDocumentAnnotations]);

  const handleTabClick = useCallback(
    (sectionId: string) => {
      scrollingByClickRef.current = true;
      setActiveSection(sectionId);
      scrollToSection(sectionId);
      // Re-enable observer after scroll completes
      setTimeout(() => {
        scrollingByClickRef.current = false;
      }, 600);
    },
    [setActiveSection, scrollToSection]
  );

  const handleSectionFocus = useCallback(
    (sectionId: string) => {
      if (!scrollingByClickRef.current) {
        setActiveSection(sectionId);
      }
    },
    [setActiveSection]
  );

  // Ticked filter tags. When any are set, the editors stay mounted but a read-only
  // FilteredView overlays them showing only those tags' excerpts (see FilteredView).
  const filterTagIds = useMemo(() => new Set(Object.values(activeFilters).flat()), [activeFilters]);

  return (
    <>
      <MainToolbar />
      <SectionTabBar onTabClick={handleTabClick} />
      <div className="editor-area" ref={editorContainerRef}>
        {sections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#9998;</div>
            <p className="empty-state-text">
              No sections yet. Click the + button in the tab bar to create your first section.
            </p>
          </div>
        ) : (
          <div className="editor-wrapper" style={filterTagIds.size > 0 ? { display: 'none' } : undefined}>
            {sections.map((section, index) => {
              const tagsForSection = sectionTags.filter(st => st.sectionId === section.id);
              return (
                <div
                  key={section.id}
                  data-section-id={section.id}
                  className="section-container"
                >
                  {index > 0 && <hr className="section-divider" />}
                  <div className="section-header">
                    {section.title}
                  </div>
                  {activeDocument && (
                    <SectionTagBar
                      sectionId={section.id}
                      documentId={activeDocument.id}
                      sectionTags={tagsForSection}
                    />
                  )}
                  <SectionEditor
                    section={section}
                    isActive={section.id === activeSectionId}
                    onFocus={handleSectionFocus}
                  />
                </div>
              );
            })}
          </div>
        )}
        {filterTagIds.size > 0 && sections.length > 0 && <FilteredView filterTagIds={filterTagIds} />}
      </div>
      <TagPopover />
      {/* No live editing surface in filter mode, so no selection toolbar. */}
      {filterTagIds.size === 0 && <SelectionToolbar />}
    </>
  );
}
