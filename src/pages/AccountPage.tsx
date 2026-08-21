import { useEffect, useState, type FormEvent } from 'react';
import type { UserAccount } from '../auth';
import { Icon } from '../components/Icon';
import { formatRole, useI18n } from '../i18n';
import { passwordMeetsPolicy, passwordPolicyMessage, passwordPolicyMinLength, passwordPolicyPattern } from '../security/passwordPolicy';
import type { SelfServiceAccountPatch } from '../services/supabaseStore';

type AccountPageProps = {
  account: UserAccount;
  saving: boolean;
  securityOnly?: boolean;
  onSave: (patch: SelfServiceAccountPatch) => void;
};

export function AccountPage({ account, saving, securityOnly = false, onSave }: AccountPageProps) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(account.displayName);
  const [phone, setPhone] = useState(account.phone ?? '');
  const [email, setEmail] = useState(account.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setDisplayName(account.displayName);
    setPhone(account.phone ?? '');
    setEmail(account.email);
  }, [account]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');

    if (password && !passwordMeetsPolicy(password)) {
      setLocalError(passwordPolicyMessage);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError(t('account.passwordMismatch'));
      return;
    }

    onSave(securityOnly
      ? { password: password || undefined }
      : { displayName, phone: phone || undefined, email, password: password || undefined });
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <section className="form-layout account-page">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('account.eyebrow')}</p>
        <h2>{t('account.title')}</h2>
        <p>{t('account.body')}</p>
        <div className="content-card account-summary-card">
          <p><strong>{t('portal.username')}:</strong> {account.username}</p>
          <p><strong>{t('portal.accountType')}:</strong> {formatRole(account.role, t)}</p>
          <p>
            <strong>{t('portal.status')}:</strong>{' '}
            <span className={`status-badge status-${account.status}`}>
              {t(`portal.status.${account.status}`)}
            </span>
          </p>
        </div>
      </div>

      <form className="form-card" onSubmit={submit}>
        {!securityOnly && <>
        <h3>{t('account.personalData')}</h3>
        <label>
          {t('portal.displayName')}
          <input
            required
            minLength={2}
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          {t('form.phone')}
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label>
          {t('form.email')}
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <small className="muted">{t('account.emailHelp')}</small>
        </label>
        </>}

        <h3>{t('account.security')}</h3>
        <label>
          {t('account.newPassword')}
          <input
            type="password"
            required={securityOnly}
            minLength={passwordPolicyMinLength}
            pattern={passwordPolicyPattern}
            title={passwordPolicyMessage}
            aria-describedby="account-password-requirements"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id="account-password-requirements" className="form-hint" role="note">{passwordPolicyMessage}</p>
        </label>
        <label>
          {t('account.confirmPassword')}
          <input
            type="password"
            required={securityOnly}
            minLength={passwordPolicyMinLength}
            pattern={passwordPolicyPattern}
            title={passwordPolicyMessage}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        {localError && <p className="form-error" role="alert">{localError}</p>}
        <button type="submit" disabled={saving}>
          {saving ? t('account.saving') : t('actions.save')}
        </button>
      </form>
    </section>
  );
}
