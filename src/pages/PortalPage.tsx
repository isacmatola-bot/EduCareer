import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import type { AdminRole, UserAccount } from '../auth';
import { adminRoleLabels } from '../auth';
import { Icon } from '../components/Icon';
import { formatAdminRole, formatRole, useI18n } from '../i18n';
import type { TabId } from '../types';

export type AdminAccountDraft = {
  username: string;
  password: string;
  displayName: string;
  email: string;
  phone: string;
  adminRole: AdminRole;
};

type AccountEditDraft = {
  displayName: string;
  email: string;
  phone: string;
  status: UserAccount['status'];
  adminRole: AdminRole;
};

export type AccountUpdatePatch = {
  displayName: string;
  email: string;
  phone?: string;
  status: UserAccount['status'];
  adminRole?: AdminRole;
};

type PortalPageProps = {
  account: UserAccount | null;
  accounts: UserAccount[];
  onNavigate: (tab: TabId) => void;
  onOpenLogin: () => void;
  onCreateAdminAccount: (draft: AdminAccountDraft) => void;
  onUpdateAccount: (accountId: string, patch: AccountUpdatePatch) => void;
  onRecoverAccount: (accountId: string) => void;
  onBlockAccount: (accountId: string) => void;
  onDeleteAccount: (accountId: string) => void;
};

const blankAdminDraft: AdminAccountDraft = {
  username: '',
  password: '',
  displayName: '',
  email: '',
  phone: '',
  adminRole: 'director'
};

const adminRoleOptions = (Object.keys(adminRoleLabels) as AdminRole[]).filter((role) => role !== 'default_admin');

export function PortalPage({
  account,
  accounts,
  onNavigate,
  onOpenLogin,
  onCreateAdminAccount,
  onUpdateAccount,
  onRecoverAccount,
  onBlockAccount,
  onDeleteAccount
}: PortalPageProps) {
  const { t } = useI18n();
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [adminDraft, setAdminDraft] = useState(blankAdminDraft);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AccountEditDraft | null>(null);

  const accountStats = useMemo(() => ({
    admins: accounts.filter((item) => item.role === 'admin').length,
    graduates: accounts.filter((item) => item.role === 'graduate').length,
    partners: accounts.filter((item) => item.role === 'partner').length,
    disabled: accounts.filter((item) => item.status === 'disabled').length
  }), [accounts]);

  if (!account) {
    return (
      <section className="form-layout">
        <div className="form-intro">
          <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('portal.eyebrow')}</p>
          <h2>{t('portal.loginTitle')}</h2>
          <p>{t('portal.loginBody')}</p>
        </div>
        <div className="form-card">
          <button type="button" onClick={onOpenLogin}>
            <Icon name="admin" />
            {t('portal.openLogin')}
          </button>
          <button className="secondary" type="button" onClick={() => onNavigate('register')}>
            <Icon name="teachers" />
            {t('portal.createAccount')}
          </button>
        </div>
      </section>
    );
  }

  const isAdmin = account.role === 'admin';
  const isDefaultAdmin = isAdmin && account.adminRole === 'default_admin';
  const roleLabel = isAdmin && account.adminRole ? formatAdminRole(account.adminRole, t) : formatRole(account.role, t);
  const statusLabel = t(`portal.status.${account.status}`);

  function submitNewAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateAdminAccount(adminDraft);
    setAdminDraft(blankAdminDraft);
    setShowCreateAdmin(false);
    setShowAccounts(true);
  }

  function startEditing(target: UserAccount) {
    setEditingAccountId(target.id);
    setShowAccounts(true);
    setEditDraft({
      displayName: target.displayName,
      email: target.email,
      phone: target.phone ?? '',
      status: target.status,
      adminRole: target.adminRole ?? 'director'
    });
  }

  function cancelEditing() {
    setEditingAccountId(null);
    setEditDraft(null);
  }

  function saveAccount(target: UserAccount) {
    if (!editDraft) return;

    onUpdateAccount(target.id, {
      displayName: editDraft.displayName,
      email: editDraft.email,
      phone: editDraft.phone || undefined,
      status: editDraft.status,
      adminRole: target.role === 'admin' ? editDraft.adminRole : undefined
    });
    cancelEditing();
  }

  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('portal.eyebrow')}</p>
        <h2>{account.displayName}</h2>
        <p className="muted">{roleLabel} · {statusLabel}</p>
      </div>

      <div className="portal-grid">
        <article className="content-card portal-profile-card">
          <h3><Icon name="admin" /> {t('portal.profile')}</h3>
          <p><strong>{t('portal.username')}:</strong> {account.username}</p>
          <p><strong>{t('portal.email')}:</strong> {account.email}</p>
          {account.phone && <p><strong>{t('portal.phone')}:</strong> {account.phone}</p>}
          <p><strong>{t('portal.accountType')}:</strong> {formatRole(account.role, t)}</p>
          {isAdmin && account.adminRole && <p><strong>{t('portal.adminLevel')}:</strong> {formatAdminRole(account.adminRole, t)}</p>}
        </article>

        <article className="content-card">
          <h3><Icon name={account.role === 'partner' ? 'partner' : 'teachers'} /> {t('portal.availableActions')}</h3>
          {account.role === 'graduate' && (
            <>
              <p className="muted">{t('portal.graduateBody')}</p>
              <button type="button" onClick={() => onNavigate('opportunities')}>
                <Icon name="opportunities" />
                {t('portal.browseOpportunities')}
              </button>
            </>
          )}
          {account.role === 'partner' && (
            <>
              <p className="muted">{t('portal.partnerBody')}</p>
              <button type="button" onClick={() => onNavigate('partners')}>
                <Icon name="partner" />
                {t('portal.updatePartner')}
              </button>
            </>
          )}
          {isAdmin && (
            <>
              <p className="muted">
                {isDefaultAdmin
                  ? t('portal.defaultAdminBody')
                  : t('portal.adminBody')}
              </p>
              <div className="portal-action-row">
                {isDefaultAdmin && (
                  <button type="button" onClick={() => setShowCreateAdmin((current) => !current)}>
                    <Icon name="admin" />
                    {t('portal.createAdmin')}
                  </button>
                )}
                <button type="button" onClick={() => onNavigate('dashboard')}>
                  <Icon name="admin" />
                  {t('portal.manageDashboard')}
                </button>
                {isDefaultAdmin && (
                  <button className="secondary" type="button" onClick={() => setShowAccounts((current) => !current)}>
                    <Icon name="teachers" />
                    {showAccounts ? t('portal.hideAccounts') : t('portal.showAccounts')}
                  </button>
                )}
              </div>
            </>
          )}
        </article>
      </div>

      {isDefaultAdmin && (
        <section className="content-card account-management-card">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('portal.platformProfiles')}</p>
              <h3>{t('portal.accountsTitle')}</h3>
              <p className="muted">{t('portal.accountsBody')}</p>
            </div>
            <div className="account-summary-row" aria-label={t('portal.accountSummary')}>
              <span>{t('portal.admins', { count: accountStats.admins })}</span>
              <span>{t('portal.graduates', { count: accountStats.graduates })}</span>
              <span>{t('portal.partners', { count: accountStats.partners })}</span>
              <span>{t('portal.blocked', { count: accountStats.disabled })}</span>
            </div>
          </div>

          {showCreateAdmin && (
            <form className="admin-account-form" onSubmit={submitNewAdmin}>
              <div className="form-section-label">{t('portal.createAdministrative')}</div>
              <div className="form-grid">
                <label>
                  {t('portal.fullNameOffice')}
                  <input
                    required
                    value={adminDraft.displayName}
                    onChange={(event) => setAdminDraft({ ...adminDraft, displayName: event.target.value })}
                  />
                </label>
                <label>
                  {t('form.username')}
                  <input
                    required
                    autoComplete="username"
                    value={adminDraft.username}
                    onChange={(event) => setAdminDraft({ ...adminDraft, username: event.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  {t('form.email')}
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={adminDraft.email}
                    onChange={(event) => setAdminDraft({ ...adminDraft, email: event.target.value })}
                  />
                </label>
                <label>
                  {t('form.phone')}
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={adminDraft.phone}
                    onChange={(event) => setAdminDraft({ ...adminDraft, phone: event.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  {t('portal.adminHierarchy')}
                  <select
                    value={adminDraft.adminRole}
                    onChange={(event) => setAdminDraft({ ...adminDraft, adminRole: event.target.value as AdminRole })}
                  >
                    {adminRoleOptions.map((role) => (
                      <option key={role} value={role}>{formatAdminRole(role, t)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('portal.temporaryPassword')}
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={adminDraft.password}
                    onChange={(event) => setAdminDraft({ ...adminDraft, password: event.target.value })}
                  />
                </label>
              </div>
              <div className="account-row-actions">
                <button type="submit">
                  <Icon name="admin" />
                  {t('portal.createAdminAccount')}
                </button>
                <button className="secondary" type="button" onClick={() => setShowCreateAdmin(false)}>
                  {t('actions.cancel')}
                </button>
              </div>
            </form>
          )}

          {showAccounts ? (
            <div className="account-list">
              {accounts.map((target) => {
                const protectedAccount = target.id === account.id || target.id === 'admin-default';
                const isEditing = editingAccountId === target.id && editDraft;
                const targetRoleLabel = target.role === 'admin' && target.adminRole
                  ? formatAdminRole(target.adminRole, t)
                  : formatRole(target.role, t);

                return (
                  <article className="account-list-item" key={target.id}>
                    <div>
                      <div className="account-title-row">
                        <h4>{target.displayName}</h4>
                        <span className={`status-badge status-${target.status}`}>{t(`portal.status.${target.status}`)}</span>
                      </div>
                      <p className="muted">{target.username} · {target.email}</p>
                      <p className="muted">{targetRoleLabel}</p>
                    </div>

                    <div className="account-row-actions">
                      <button className="secondary" type="button" onClick={() => startEditing(target)}>
                        {t('actions.edit')}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={target.status === 'active'}
                        onClick={() => onRecoverAccount(target.id)}
                      >
                        {t('actions.recover')}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={protectedAccount || target.status === 'disabled'}
                        onClick={() => onBlockAccount(target.id)}
                      >
                        {t('actions.block')}
                      </button>
                      <button
                        className="secondary danger-button"
                        type="button"
                        disabled={protectedAccount}
                        onClick={() => onDeleteAccount(target.id)}
                      >
                        {t('actions.delete')}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="account-edit-panel">
                        <div className="form-grid">
                          <label>
                            {t('portal.displayName')}
                            <input
                              required
                              value={editDraft.displayName}
                              onChange={(event) => setEditDraft({ ...editDraft, displayName: event.target.value })}
                            />
                          </label>
                          <label>
                            {t('form.email')}
                            <input
                              required
                              type="email"
                              value={editDraft.email}
                              onChange={(event) => setEditDraft({ ...editDraft, email: event.target.value })}
                            />
                          </label>
                        </div>
                        <div className="form-grid">
                          <label>
                            {t('form.phone')}
                            <input
                              type="tel"
                              value={editDraft.phone}
                              onChange={(event) => setEditDraft({ ...editDraft, phone: event.target.value })}
                            />
                          </label>
                          <label>
                            {t('portal.status')}
                            <select
                              value={editDraft.status}
                              onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value as UserAccount['status'] })}
                            >
                              <option value="active">{t('portal.status.active')}</option>
                              <option value="pending">{t('portal.status.pending')}</option>
                              <option value="disabled">{t('portal.status.disabled')}</option>
                            </select>
                          </label>
                        </div>
                        {target.role === 'admin' && (
                          <label>
                            {t('portal.adminHierarchy')}
                            <select
                              value={editDraft.adminRole}
                              onChange={(event) => setEditDraft({ ...editDraft, adminRole: event.target.value as AdminRole })}
                            >
                              {(target.id === 'admin-default' ? ['default_admin'] as AdminRole[] : adminRoleOptions).map((role) => (
                                <option key={role} value={role}>{formatAdminRole(role, t)}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="account-row-actions">
                          <button type="button" onClick={() => saveAccount(target)}>
                            {t('actions.save')}
                          </button>
                          <button className="secondary" type="button" onClick={cancelEditing}>
                            {t('actions.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">{t('portal.useShowAccounts')}</p>
          )}
        </section>
      )}
    </section>
  );
}
