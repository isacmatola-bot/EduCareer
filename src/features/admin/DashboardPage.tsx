import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasAdminPermission, type UserAccount } from '../../auth';
import { Icon } from '../../components/Icon';
import { formatAdminRole, useI18n } from '../../i18n';
import { isSupabaseConfigured, requireSupabase } from '../../services/supabaseClient';
import {
  loadAdminWorkflow,
  reviewOpportunityApplication,
  reviewPartnerRequest,
  type AdminApplicationReview,
  type AdminPartnerReview,
  type ApplicationReviewStatus,
  type PartnerReviewStatus
} from '../../services/adminWorkflow';
import type { CandidateApplication, PartnerRequest } from '../../types';

type DashboardPageProps = {
  stats: { label: string; value: string }[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
  currentAdmin: UserAccount | null;
};

type DashboardCopy = {
  loading: string;
  loadError: string;
  refresh: string;
  readOnly: string;
  terminal: string;
  submitted: string;
  reviewing: string;
  accepted: string;
  rejected: string;
  approved: string;
  withdrawn: string;
  markReviewing: string;
  accept: string;
  reject: string;
  approve: string;
  applicant: string;
  opportunity: string;
  requestedBy: string;
  noAccess: string;
  updated: string;
};

const dashboardCopy: Record<'en' | 'pt' | 'jp', DashboardCopy> = {
  en: {
    loading: 'Loading operational queues…',
    loadError: 'Unable to load operational dashboard data.',
    refresh: 'Refresh',
    readOnly: 'Read-only for your administrative role.',
    terminal: 'Final decision recorded. No further status changes are available.',
    submitted: 'Submitted',
    reviewing: 'Reviewing',
    accepted: 'Accepted',
    rejected: 'Rejected',
    approved: 'Approved',
    withdrawn: 'Withdrawn',
    markReviewing: 'Mark reviewing',
    accept: 'Accept',
    reject: 'Reject',
    approve: 'Approve',
    applicant: 'Applicant',
    opportunity: 'Opportunity',
    requestedBy: 'Requested by',
    noAccess: 'This queue is outside your administrative scope.',
    updated: 'Workflow updated.'
  },
  pt: {
    loading: 'A carregar filas operacionais…',
    loadError: 'Não foi possível carregar os dados operacionais do dashboard.',
    refresh: 'Actualizar',
    readOnly: 'Acesso apenas de leitura para a sua função administrativa.',
    terminal: 'Decisão final registada. Não estão disponíveis novas alterações de estado.',
    submitted: 'Submetida',
    reviewing: 'Em análise',
    accepted: 'Aceite',
    rejected: 'Rejeitada',
    approved: 'Aprovado',
    withdrawn: 'Retirada',
    markReviewing: 'Colocar em análise',
    accept: 'Aceitar',
    reject: 'Rejeitar',
    approve: 'Aprovar',
    applicant: 'Candidato',
    opportunity: 'Oportunidade',
    requestedBy: 'Solicitado por',
    noAccess: 'Esta fila está fora do âmbito da sua função administrativa.',
    updated: 'Fluxo actualizado.'
  },
  jp: {
    loading: '運用キューを読み込んでいます…',
    loadError: '管理ダッシュボードの運用データを読み込めませんでした。',
    refresh: '更新',
    readOnly: '現在の管理権限では閲覧のみ可能です。',
    terminal: '最終決定が記録されています。これ以上のステータス変更はできません。',
    submitted: '提出済み',
    reviewing: '審査中',
    accepted: '承認済み',
    rejected: '却下',
    approved: '承認',
    withdrawn: '取下げ',
    markReviewing: '審査中にする',
    accept: '承認する',
    reject: '却下する',
    approve: '承認する',
    applicant: '応募者',
    opportunity: '機会',
    requestedBy: '申請者',
    noAccess: 'このキューは現在の管理権限の対象外です。',
    updated: 'ワークフローを更新しました。'
  }
};

export function DashboardPage({ stats, candidates, partners, currentAdmin }: DashboardPageProps) {
  const { language, t } = useI18n();
  const copy = dashboardCopy[language];
  const canReadApplications = hasAdminPermission(currentAdmin, 'applications.read');
  const canManageApplications = hasAdminPermission(currentAdmin, 'applications.manage');
  const canReadPartners = hasAdminPermission(currentAdmin, 'partner_requests.read');
  const canManagePartners = hasAdminPermission(currentAdmin, 'partner_requests.manage');
  const [applications, setApplications] = useState<AdminApplicationReview[]>([]);
  const [partnerReviews, setPartnerReviews] = useState<AdminPartnerReview[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [success, setSuccess] = useState('');

  const loadWorkflow = useCallback(async () => {
    if (!isSupabaseConfigured || !currentAdmin) return;
    setLoading(true);
    setError('');
    try {
      const workflow = await loadAdminWorkflow({
        applications: canReadApplications,
        partners: canReadPartners
      });
      setApplications(workflow.applications);
      setPartnerReviews(workflow.partners);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [canReadApplications, canReadPartners, copy.loadError, currentAdmin]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  useEffect(() => {
    if (!isSupabaseConfigured || !currentAdmin || (!canReadApplications && !canReadPartners)) return;

    const client = requireSupabase();
    let channel = client.channel(`admin-workflow-${currentAdmin.id}`);

    if (canReadApplications) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunity_applications' },
        () => void loadWorkflow()
      );
    }

    if (canReadPartners) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_requests' },
        () => void loadWorkflow()
      );
    }

    channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [canReadApplications, canReadPartners, currentAdmin, loadWorkflow]);

  const operationalStats = useMemo(() => stats.map((stat, index) => {
    if (!isSupabaseConfigured) return stat;
    if (index === 0 && canReadApplications) return { ...stat, value: applications.length.toString() };
    if (index === 1 && canReadPartners) return { ...stat, value: partnerReviews.length.toString() };
    return stat;
  }), [applications.length, canReadApplications, canReadPartners, partnerReviews.length, stats]);

  async function changeApplicationStatus(
    applicationId: string,
    status: Exclude<ApplicationReviewStatus, 'submitted' | 'withdrawn'>
  ) {
    setBusyId(applicationId);
    setError('');
    setSuccess('');
    try {
      await reviewOpportunityApplication(applicationId, status);
      await loadWorkflow();
      setSuccess(copy.updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.loadError);
    } finally {
      setBusyId('');
    }
  }

  async function changePartnerStatus(
    requestId: string,
    status: Exclude<PartnerReviewStatus, 'submitted'>
  ) {
    setBusyId(requestId);
    setError('');
    setSuccess('');
    try {
      await reviewPartnerRequest(requestId, status);
      await loadWorkflow();
      setSuccess(copy.updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.loadError);
    } finally {
      setBusyId('');
    }
  }

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
        {operationalStats.map((stat) => (
          <article className="metric-card compact" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      {isSupabaseConfigured && loading && <p className="muted">{copy.loading}</p>}
      {error && (
        <div className="notice" role="alert">
          <span>{copy.loadError} {error}</span>
          <button type="button" onClick={() => void loadWorkflow()}>{copy.refresh}</button>
        </div>
      )}
      {success && <p className="muted" role="status">{success}</p>}

      {isSupabaseConfigured ? (
        <div className="dashboard-grid">
          <OperationalApplicationList
            title={t('dashboard.candidateApplications')}
            empty={t('dashboard.noCandidates')}
            items={applications}
            canRead={canReadApplications}
            canManage={canManageApplications}
            busyId={busyId}
            copy={copy}
            onChangeStatus={changeApplicationStatus}
          />
          <OperationalPartnerList
            title={t('dashboard.partnerRequests')}
            empty={t('dashboard.noPartners')}
            items={partnerReviews}
            canRead={canReadPartners}
            canManage={canManagePartners}
            busyId={busyId}
            copy={copy}
            onChangeStatus={changePartnerStatus}
          />
        </div>
      ) : (
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
      )}
    </section>
  );
}

function OperationalApplicationList({
  title,
  empty,
  items,
  canRead,
  canManage,
  busyId,
  copy,
  onChangeStatus
}: {
  title: string;
  empty: string;
  items: AdminApplicationReview[];
  canRead: boolean;
  canManage: boolean;
  busyId: string;
  copy: DashboardCopy;
  onChangeStatus: (id: string, status: 'reviewing' | 'accepted' | 'rejected') => Promise<void>;
}) {
  return (
    <article className="content-card dashboard-list">
      <h3>{title}</h3>
      {!canRead ? (
        <p className="muted">{copy.noAccess}</p>
      ) : items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        items.map((item) => (
          <div className="dashboard-item" key={item.id}>
            <div className="action-row">
              <span className={`status ${statusClass(item.status)}`}>{statusLabel(item.status, copy)}</span>
            </div>
            <h4>{item.applicantName}</h4>
            <p className="muted"><strong>{copy.opportunity}:</strong> {item.opportunityTitle}</p>
            <p><strong>{copy.applicant}:</strong> {item.applicantUsername || '—'} · {item.applicantEmail || '—'}</p>
            <small>{new Date(item.createdAt).toLocaleString()}</small>
            {canManage ? (
              item.status === 'submitted' ? (
                <div className="action-row">
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onChangeStatus(item.id, 'reviewing')}
                  >{copy.markReviewing}</button>
                </div>
              ) : item.status === 'reviewing' ? (
                <div className="action-row">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onChangeStatus(item.id, 'accepted')}
                  >{copy.accept}</button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onChangeStatus(item.id, 'rejected')}
                  >{copy.reject}</button>
                </div>
              ) : (
                <p className="muted">{copy.terminal}</p>
              )
            ) : (
              <p className="muted">{copy.readOnly}</p>
            )}
          </div>
        ))
      )}
    </article>
  );
}

function OperationalPartnerList({
  title,
  empty,
  items,
  canRead,
  canManage,
  busyId,
  copy,
  onChangeStatus
}: {
  title: string;
  empty: string;
  items: AdminPartnerReview[];
  canRead: boolean;
  canManage: boolean;
  busyId: string;
  copy: DashboardCopy;
  onChangeStatus: (id: string, status: 'reviewing' | 'approved' | 'rejected') => Promise<void>;
}) {
  return (
    <article className="content-card dashboard-list">
      <h3>{title}</h3>
      {!canRead ? (
        <p className="muted">{copy.noAccess}</p>
      ) : items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        items.map((item) => (
          <div className="dashboard-item" key={item.id}>
            <div className="action-row">
              <span className={`status ${statusClass(item.status)}`}>{statusLabel(item.status, copy)}</span>
            </div>
            <h4>{item.organizationName}</h4>
            <p className="muted">{item.organizationType} · {item.contactPerson}</p>
            <p>{item.supportNeeded}</p>
            <small>{copy.requestedBy}: {item.username || '—'} · {item.email} · {item.phone}</small>
            {canManage ? (
              item.status === 'submitted' ? (
                <div className="action-row">
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onChangeStatus(item.id, 'reviewing')}
                  >{copy.markReviewing}</button>
                </div>
              ) : item.status === 'reviewing' ? (
                <div className="action-row">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onChangeStatus(item.id, 'approved')}
                  >{copy.approve}</button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onChangeStatus(item.id, 'rejected')}
                  >{copy.reject}</button>
                </div>
              ) : (
                <p className="muted">{copy.terminal}</p>
              )
            ) : (
              <p className="muted">{copy.readOnly}</p>
            )}
          </div>
        ))
      )}
    </article>
  );
}

function statusClass(status: ApplicationReviewStatus | PartnerReviewStatus): string {
  if (status === 'accepted' || status === 'approved') return 'status-open';
  if (status === 'rejected' || status === 'withdrawn') return 'status-closed';
  return 'status-upcoming';
}

function statusLabel(status: ApplicationReviewStatus | PartnerReviewStatus, copy: DashboardCopy): string {
  return copy[status as keyof Pick<
    DashboardCopy,
    'submitted' | 'reviewing' | 'accepted' | 'rejected' | 'approved' | 'withdrawn'
  >];
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
