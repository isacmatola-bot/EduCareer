import { useState } from 'react';
import { Icon } from '../components/Icon';
import { localizeProgram, useI18n } from '../i18n';
import type { Program } from '../types';
import { getProgramIcon } from '../utils/presentation';

type ProgramsPageProps = {
  programs: Program[];
  canManage: boolean;
  onCreate: (program: Program) => void;
  onUpdate: (program: Program) => void;
};

export function ProgramsPage({ programs, canManage, onCreate, onUpdate }: ProgramsPageProps) {
  const { language, t } = useI18n();
  const [editing, setEditing] = useState<Program | null>(null);

  function createProgram() {
    setEditing({ id: `program-${Date.now()}`, name: '', tagline: '', description: '', activities: [], status: 'draft' });
  }

  function saveProgram() {
    if (!editing || !editing.name.trim() || !editing.description.trim()) return;
    const program = { ...editing, name: editing.name.trim(), description: editing.description.trim() };
    (programs.some((item) => item.id === program.id) ? onUpdate : onCreate)(program);
    setEditing(null);
  }

  const visiblePrograms = canManage ? programs : programs.filter((program) => program.status === 'published');

  return (
    <section className="section-stack">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="programs" /> {t('programs.eyebrow')}</p>
          <h2>{t('programs.title')}</h2>
        </div>
        {canManage && <button className="admin-icon-button create-icon-button" type="button" onClick={createProgram} aria-label={t('programs.create')} title={t('programs.create')}><Icon name="add" /></button>}
      </div>

      {canManage && editing && (
        <div className="content-card program-editor">
          <h3>{t('programs.editorTitle')}</h3>
          <label>{t('programs.name')}<input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label>{t('programs.tagline')}<input value={editing.tagline} onChange={(event) => setEditing({ ...editing, tagline: event.target.value })} /></label>
          <label>{t('programs.description')}<textarea required value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
          <label>{t('programs.activities')}<textarea value={editing.activities.join('\n')} onChange={(event) => setEditing({ ...editing, activities: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
          <div className="portal-action-row">
            <button type="button" onClick={saveProgram}>{t('actions.save')}</button>
            <button className="secondary" type="button" onClick={() => setEditing(null)}>{t('actions.cancel')}</button>
          </div>
        </div>
      )}

      <div className="program-grid">
        {visiblePrograms.map((program) => {
          const localizedProgram = localizeProgram(language, program);
          return (
            <article className="program-card program-card-with-icon" key={program.id}>
              <span className="program-icon"><Icon name={getProgramIcon(program.id)} /></span>
              <p className="eyebrow">{localizedProgram.tagline}</p>
              <h3>{localizedProgram.name}</h3>
              <p>{localizedProgram.description}</p>
              <ul>{localizedProgram.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>
              {canManage && (
                <div className="program-admin-actions">
                  <span className={`status-badge status-${program.status}`}>{t(`programs.status.${program.status}`)}</span>
                  <button className="secondary admin-icon-button" type="button" onClick={() => setEditing(program)} aria-label={t('actions.edit')} title={t('actions.edit')}><Icon name="edit" /></button>
                  {program.status !== 'published' && <button type="button" onClick={() => onUpdate({ ...program, status: 'published' })}>{t('programs.publish')}</button>}
                  {program.status === 'published' && <button className="secondary admin-icon-button" type="button" onClick={() => onUpdate({ ...program, status: 'closed' })} aria-label={t('programs.close')} title={t('programs.close')}><Icon name="close" /></button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
