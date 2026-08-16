import { useState } from 'react';
import { Icon } from '../components/Icon';
import { localizeOpportunity, localizeOpportunityType, localizeStatus, useI18n } from '../i18n';
import type { Opportunity } from '../types';
import { getOpportunityIcon } from '../utils/presentation';

type OpportunitiesPageProps = {
  opportunities: Opportunity[];
  canManage: boolean;
  canApply: boolean;
  isLoading: boolean;
  loadError?: string;
  onCreate: (opportunity: Opportunity) => Promise<void>;
  onUpdate: (opportunity: Opportunity) => Promise<void>;
  onDelete: (opportunityId: string) => Promise<void>;
  onApplyOpportunity: (opportunity: Opportunity) => void;
};

export function OpportunitiesPage({
  opportunities,
  canManage,
  canApply,
  isLoading,
  loadError,
  onCreate,
  onUpdate,
  onDelete,
  onApplyOpportunity
}: OpportunitiesPageProps) {
  const { language, t } = useI18n();
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState('');
  const locale = language === 'jp' ? 'ja-JP' : language === 'pt' ? 'pt-PT' : 'en-US';

  function createOpportunity() {
    setOperationError('');
    setEditing({
      id: `opportunity-${Date.now()}`,
      title: '',
      institution: '',
      location: '',
      type: 'Internship',
      deadline: new Date().toISOString().slice(0, 10),
      status: 'Open',
      requirements: []
    });
  }

  async function saveOpportunity() {
    if (!editing || !editing.title.trim() || !editing.institution.trim() || !editing.location.trim()) return;
    const opportunity = {
      ...editing,
      title: editing.title.trim(),
      institution: editing.institution.trim(),
      location: editing.location.trim()
    };

    setPendingOpportunityId(opportunity.id);
    setOperationError('');

    try {
      await (opportunities.some((item) => item.id === opportunity.id) ? onUpdate : onCreate)(opportunity);
      setEditing(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('messages.contentUnable'));
    } finally {
      setPendingOpportunityId(null);
    }
  }

  async function updateOpportunity(opportunity: Opportunity) {
    setPendingOpportunityId(opportunity.id);
    setOperationError('');

    try {
      await onUpdate(opportunity);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('messages.contentUnable'));
    } finally {
      setPendingOpportunityId(null);
    }
  }

  async function deleteOpportunity(opportunity: Opportunity) {
    if (!window.confirm(t('opportunities.deleteConfirm', { title: opportunity.title }))) return;

    setPendingOpportunityId(opportunity.id);
    setOperationError('');

    try {
      await onDelete(opportunity.id);
      if (editing?.id === opportunity.id) setEditing(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('messages.opportunityDeleteUnable'));
    } finally {
      setPendingOpportunityId(null);
    }
  }

  return (
    <section className="section-stack">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="opportunities" /> {t('opportunities.eyebrow')}</p>
          <h2>{t('opportunities.title')}</h2>
        </div>
        {canManage && <button className="admin-icon-button create-icon-button" type="button" onClick={createOpportunity} disabled={isLoading} aria-label={t('opportunities.create')} title={t('opportunities.create')}><Icon name="add" /></button>}
      </div>

      {isLoading && <p className="content-card muted" role="status">{t('opportunities.loading')}</p>}
      {loadError && <p className="content-card form-error" role="alert">{t('opportunities.loadError')}: {loadError}</p>}
      {operationError && <p className="content-card form-error" role="alert">{operationError}</p>}

      {canManage && editing && (
        <div className="content-card opportunity-editor">
          <h3>{t('opportunities.editorTitle')}</h3>
          <label>{t('opportunities.name')}<input required value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
          <label>{t('opportunities.institution')}<input required value={editing.institution} onChange={(event) => setEditing({ ...editing, institution: event.target.value })} /></label>
          <label>{t('opportunities.location')}<input required value={editing.location} onChange={(event) => setEditing({ ...editing, location: event.target.value })} /></label>
          <label>{t('opportunities.type')}
            <select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as Opportunity['type'] })}>
              {(['Assistant Teacher', 'Internship', 'Mentorship', 'Seminar', 'Practice Teaching'] as Opportunity['type'][]).map((type) => (
                <option key={type} value={type}>{localizeOpportunityType(language, type)}</option>
              ))}
            </select>
          </label>
          <label>{t('opportunities.deadline')}<input type="date" required value={editing.deadline} onChange={(event) => setEditing({ ...editing, deadline: event.target.value })} /></label>
          <label>{t('opportunities.requirements')}<textarea value={editing.requirements.join('\n')} onChange={(event) => setEditing({ ...editing, requirements: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
          <div className="portal-action-row">
            <button type="button" onClick={() => void saveOpportunity()} disabled={pendingOpportunityId === editing.id}>{pendingOpportunityId === editing.id ? t('actions.saving') : t('actions.save')}</button>
            <button className="secondary" type="button" onClick={() => setEditing(null)} disabled={pendingOpportunityId === editing.id}>{t('actions.cancel')}</button>
          </div>
        </div>
      )}
      {!isLoading && !loadError && opportunities.length === 0 && (
        <p className="content-card muted">{t('opportunities.empty')}</p>
      )}
      <div className="opportunity-list">
        {opportunities.map((opportunity) => {
          const localizedOpportunity = localizeOpportunity(language, opportunity);
          const isPending = pendingOpportunityId === opportunity.id;

          return (
            <article className="opportunity-card" key={opportunity.id}>
              <div>
                <span className={`status status-${opportunity.status.toLowerCase()}`}>
                  {localizeStatus(opportunity.status, t)}
                </span>
                <h3><Icon name={getOpportunityIcon(opportunity.type)} /> {localizedOpportunity.title}</h3>
                <p>{localizedOpportunity.institution} · {localizedOpportunity.location}</p>
              </div>
              <div className="opportunity-meta">
                <span>{localizeOpportunityType(language, opportunity.type)}</span>
                <span>{t('opportunities.deadline')}: {new Date(opportunity.deadline).toLocaleDateString(locale)}</span>
                {canManage ? (
                  <div className="opportunity-admin-actions">
                    <button className="secondary admin-icon-button" type="button" disabled={isPending} onClick={() => setEditing(opportunity)} aria-label={t('actions.edit')} title={t('actions.edit')}><Icon name="edit" /></button>
                    <button className="secondary admin-icon-button" type="button" disabled={isPending} onClick={() => void updateOpportunity({ ...opportunity, status: opportunity.status === 'Closed' ? 'Open' : 'Closed' })} aria-label={opportunity.status === 'Closed' ? t('opportunities.reopen') : t('opportunities.close')} title={opportunity.status === 'Closed' ? t('opportunities.reopen') : t('opportunities.close')}>
                      <Icon name={opportunity.status === 'Closed' ? 'add' : 'close'} />
                    </button>
                    <button className="secondary admin-icon-button" type="button" disabled={isPending} onClick={() => void deleteOpportunity(opportunity)} aria-label={t('actions.delete')} title={t('actions.delete')}><Icon name="delete" /></button>
                  </div>
                ) : canApply ? (
                  <button className="secondary opportunity-action" type="button" disabled={opportunity.status === 'Closed'} onClick={() => onApplyOpportunity(opportunity)}>
                    <Icon name="opportunities" />
                    {opportunity.status === 'Closed' ? t('opportunities.closed') : t('opportunities.apply')}
                  </button>
                ) : null}
              </div>
              <ul>
                {localizedOpportunity.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
