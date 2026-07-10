import type { ViewerRole } from '../auth';
import { Icon } from '../components/Icon';
import { opportunities } from '../data';
import { localizeOpportunity, localizeOpportunityType, localizeStatus, useI18n } from '../i18n';
import type { Opportunity } from '../types';
import type { TabId } from '../types';
import { getOpportunityIcon } from '../utils/presentation';

type OpportunitiesPageProps = {
  viewerRole: ViewerRole;
  onNavigate: (tab: TabId) => void;
  onApplyOpportunity: (opportunity: Opportunity) => void;
};

export function OpportunitiesPage({ viewerRole, onNavigate, onApplyOpportunity }: OpportunitiesPageProps) {
  const { language, t } = useI18n();
  const locale = language === 'jp' ? 'ja-JP' : language === 'pt' ? 'pt-PT' : 'en-US';

  return (
    <section className="section-stack">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="opportunities" /> {t('opportunities.eyebrow')}</p>
          <h2>{t('opportunities.title')}</h2>
        </div>
        <button type="button" onClick={() => onNavigate('register')}>
          <Icon name="teachers" />
          {viewerRole === 'visitor' ? t('opportunities.createGraduate') : t('opportunities.applyCandidate')}
        </button>
      </div>
      <div className="opportunity-list">
        {opportunities.map((opportunity) => {
          const localizedOpportunity = localizeOpportunity(language, opportunity);

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
                <button
                  className="secondary opportunity-action"
                  type="button"
                  disabled={opportunity.status === 'Closed'}
                  onClick={() => onApplyOpportunity(opportunity)}
                >
                  <Icon name="opportunities" />
                  {opportunity.status === 'Closed' ? t('opportunities.closed') : t('opportunities.apply')}
                </button>
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
