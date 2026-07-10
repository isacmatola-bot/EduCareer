import type { UserAccount } from '../../auth';
import { Icon } from '../../components/Icon';
import { formatAdminRole, useI18n } from '../../i18n';
import type { CandidateApplication, PartnerRequest } from '../../types';

type DashboardPageProps = {
  stats: { label: string; value: string }[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
  currentAdmin: UserAccount | null;
};

export function DashboardPage({ stats, candidates, partners, currentAdmin }: DashboardPageProps) {
  const { t } = useI18n();

  return (
    <section className="section-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('dashboard.eyebrow')}</p>
          <h2>{t('dashboard.title')}</h2>
          {currentAdmin && (
            <p className="muted">
              {t('dashboard.loggedInAs', {
                name: currentAdmin.displayName,
                role: currentAdmin.adminRole ? formatAdminRole(currentAdmin.adminRole, t) : t('role.admin')
              })}
            </p>
          )}
        </div>
      </div>
      <div className="metric-grid dashboard-metric-grid">
        {stats.map((stat) => (
          <article className="metric-card compact" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <DashboardList
          title={t('dashboard.candidateApplications')}
          empty={t('dashboard.noCandidates')}
          items={candidates.map((candidate) => ({
            id: candidate.id,
            title: candidate.fullName,
            subtitle: `${candidate.teachingArea} · ${candidate.preferredProgram}`,
            body: candidate.motivation,
            meta: `${candidate.username || t('dashboard.noUsername')} · ${candidate.email} · ${candidate.phone}`
          }))}
        />
        <DashboardList
          title={t('dashboard.partnerRequests')}
          empty={t('dashboard.noPartners')}
          items={partners.map((partner) => ({
            id: partner.id,
            title: partner.organizationName,
            subtitle: `${partner.organizationType} · ${partner.contactPerson}`,
            body: partner.supportNeeded,
            meta: `${partner.username || t('dashboard.noUsername')} · ${partner.email} · ${partner.phone}`
          }))}
        />
      </div>
    </section>
  );
}

type DashboardListProps = {
  title: string;
  empty: string;
  items: { id: string; title: string; subtitle: string; body: string; meta: string }[];
};

function DashboardList({ title, empty, items }: DashboardListProps) {
  return (
    <article className="content-card dashboard-list">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        items.map((item) => (
          <div className="dashboard-item" key={item.id}>
            <h4>{item.title}</h4>
            <p className="muted">{item.subtitle}</p>
            <p>{item.body}</p>
            <small>{item.meta}</small>
          </div>
        ))
      )}
    </article>
  );
}
