import type { FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';

type AdminLoginPageProps = {
  adminUsername: string;
  adminCode: string;
  adminError: string;
  setAdminUsername: (value: string) => void;
  setAdminCode: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AdminLoginPage({
  adminUsername,
  adminCode,
  adminError,
  setAdminUsername,
  setAdminCode,
  onSubmit
}: AdminLoginPageProps) {
  const { t } = useI18n();

  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('adminLogin.eyebrow')}</p>
        <h2>{t('adminLogin.title')}</h2>
        <p>{t('adminLogin.body')}</p>
        <p className="muted">{t('adminLogin.note')}</p>
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        <div className="credential-panel admin-credential-panel">
          <div className="credential-panel-heading">
              <span><Icon name="admin" /></span>
              <div>
              <h3>{t('adminLogin.credentials')}</h3>
              <p>{t('adminLogin.credentialsBody')}</p>
              </div>
            </div>
          <div className="form-grid">
            <label>
              {t('form.username')}
              <input
                required
                autoComplete="username"
                value={adminUsername}
                onChange={(event) => setAdminUsername(event.target.value)}
                placeholder={t('adminLogin.usernamePlaceholder')}
              />
            </label>
            <label>
              {t('form.password')}
              <input
                required
                type="password"
                autoComplete="current-password"
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
                placeholder={t('adminLogin.passwordPlaceholder')}
              />
            </label>
          </div>
        </div>

        {adminError && <p className="muted">{adminError}</p>}

        <button type="submit">
          <Icon name="admin" />
          {t('adminLogin.openDashboard')}
        </button>
      </form>
    </section>
  );
}
