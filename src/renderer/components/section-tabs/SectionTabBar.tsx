import React, { useState } from 'react';
import { useStore } from '../../stores';
import { SectionTab } from './SectionTab';
import { Modal } from '../common/Modal';
import { generateAbbreviation } from '../../lib/section-utils';
import type { Section } from '../../../shared/domain-types';

interface SectionTabBarProps {
  onTabClick: (sectionId: string) => void;
  /** Sections currently shown in the editor — tag filters hide the rest here too. */
  visibleSections?: Section[];
}

export function SectionTabBar({ onTabClick, visibleSections }: SectionTabBarProps) {
  const allSections = useStore(s => s.sections);
  const sections = visibleSections ?? allSections;
  const activeSectionId = useStore(s => s.activeSectionId);
  const createSection = useStore(s => s.createSection);
  const deleteSection = useStore(s => s.deleteSection);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAbbreviation, setNewAbbreviation] = useState('');

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const abbr = newAbbreviation.trim() || generateAbbreviation(newTitle.trim());
    const section = await createSection(newTitle.trim(), abbr);
    setShowCreate(false);
    setNewTitle('');
    setNewAbbreviation('');
    onTabClick(section.id);
  };

  return (
    <>
      <div className="tab-bar">
        {sections.map(section => (
          <SectionTab
            key={section.id}
            id={section.id}
            label={section.id === activeSectionId ? section.title : section.abbreviation}
            isActive={section.id === activeSectionId}
            onClick={() => onTabClick(section.id)}
            onClose={() => deleteSection(section.id)}
          />
        ))}
        <button className="tab-add" onClick={() => setShowCreate(true)} title="Add section">
          +
        </button>
      </div>

      <Modal
        title="New Section"
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreate}>
              Create
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Title</label>
          <input
            className="input"
            value={newTitle}
            onChange={e => {
              setNewTitle(e.target.value);
              if (!newAbbreviation) {
                setNewAbbreviation(generateAbbreviation(e.target.value));
              }
            }}
            placeholder="e.g. Ancient Age"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Abbreviation</label>
          <input
            className="input"
            value={newAbbreviation}
            onChange={e => setNewAbbreviation(e.target.value)}
            placeholder="e.g. ANC"
            maxLength={5}
          />
        </div>
      </Modal>
    </>
  );
}
