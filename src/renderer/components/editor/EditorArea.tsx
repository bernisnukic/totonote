import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../../stores';
import { useSectionScroll } from '../../hooks/useSectionScroll';
import { MainToolbar } from '../toolbar/MainToolbar';
import { SectionTabBar } from '../section-tabs/SectionTabBar';
import { SectionEditor } from './SectionEditor';
import { SectionTagBar } from './SectionTagBar';
import { TagPopover } from './TagPopover';
import { SelectionToolbar } from './SelectionToolbar';

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

  // Filter logic: compute which sections to show based on active tag filters
  const filteredSections = useMemo(() => {
    const activeFilterTagIds = new Set(
      Object.values(activeFilters).flat()
    );
    if (activeFilterTagIds.size === 0) return sections;

    return sections.filter(section => {
      // Check section tags
      const hasSectionTag = sectionTags.some(
        st => st.sectionId === section.id && activeFilterTagIds.has(st.tagId)
      );
      if (hasSectionTag) return true;

      // Check annotations in this section
      const hasAnnotation = documentAnnotations.some(
        a => a.sectionId === section.id && activeFilterTagIds.has(a.tagId)
      );
      return hasAnnotation;
    });
  }, [sections, activeFilters, sectionTags, documentAnnotations]);

  const hasActiveFilters = Object.values(activeFilters).some(v => v.length > 0);

  return (
    <>
      <MainToolbar />
      <SectionTabBar onTabClick={handleTabClick} visibleSections={filteredSections} />
      <div className="editor-area" ref={editorContainerRef}>
        {sections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#9998;</div>
            <p className="empty-state-text">
              No sections yet. Click the + button in the tab bar to create your first section.
            </p>
          </div>
        ) : filteredSections.length === 0 && hasActiveFilters ? (
          <div className="empty-state">
            <p className="empty-state-text">
              No sections match the active filters.
            </p>
          </div>
        ) : (
          <div className="editor-wrapper">
            {filteredSections.map((section, index) => {
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
      </div>
      <TagPopover />
      <SelectionToolbar />
    </>
  );
}
