import type { FormEvent } from 'react';
import type { LoginForm, RegistrationMode } from '../auth';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

type WelcomeDialogProps = {
  loginForm: LoginForm;
  loginError: string;
  onLoginFormChange: (form: LoginForm) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onContinueAsVisitor: () => void;
  onStartRegistration: (mode: RegistrationMode) => void;
};

export function WelcomeDialog({
  loginForm,
  loginError,
  onLoginFormChange,
  onLogin,
  onContinueAsVisitor,
  onStartRegistration
}: WelcomeDialogProps) {
  const { t } = useI18n();

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className="welcome-dialog">
        <div className="welcome-panel">
          <p className="eyebrow icon-eyebrow">
            <Icon name="bridge" />
            {t('welcome.eyebrow')}
          </p>
          <h2 id="welcome-title">{t('welcome.title')}</h2>
          <p>{t('welcome.body')}</p>
          <div className="welcome-choice-grid">
            <button type="button" onClick={onContinueAsVisitor}>
              <Icon name="home" />
              {t('welcome.visitor')}
            </button>
            <button className="secondary" type="button" onClick={() => onStartRegistration('graduate')}>
              <Icon name="teachers" />
              {t('welcome.createGraduate')}
            </button>
            <button className="secondary" type="button" onClick={() => onStartRegistration('partner')}>
              <Icon name="partner" />
              {t('welcome.createPartner')}
            </button>
          </div>
        </div>

        <form className="welcome-login-card" onSubmit={onLogin}>
          <div className="credential-panel admin-credential-panel">
            <div className="credential-panel-heading">
              <span><Icon name="admin" /></span>
              <div>
                <h3>{t('welcome.loginTitle')}</h3>
                <p>{t('welcome.loginBody')}</p>
              </div>
            </div>
            <label>
              {t('form.username')}
              <input
                required
                autoComplete="username"
                value={loginForm.username}
                onChange={(event) => onLoginFormChange({ ...loginForm, username: event.target.value })}
              />
            </label>
            <label>
              {t('form.password')}
              <input
                required
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) => onLoginFormChange({ ...loginForm, password: event.target.value })}
              />
            </label>
          </div>

          {loginError && <p className="auth-error">{loginError}</p>}

          <button type="submit">
            <Icon name="admin" />
            {t('actions.login')}
          </button>
        </form>
      </section>
    </div>
  );
}
