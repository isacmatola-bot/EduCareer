import type { MouseEvent, ReactNode } from 'react';
import type { ViewerRole } from '../auth';
import { languages, tabs } from '../constants';
import { contact } from '../data';
import { useI18n, type LanguageCode } from '../i18n';
import { routeForTab } from '../router';
import type { TabId } from '../types';
import { Icon } from './Icon';

type AppLayoutProps = {
  activeTab: TabId;
  selectedLanguage: LanguageCode;
  canGoBack: boolean;
  canGoForward: boolean;
  viewerRole: ViewerRole;
  accountLabel: string;
  adminPortalOnly: boolean;
  children: ReactNode;
  onNavigate: (tab: TabId) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onBack: () => void;
  onForward: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
};

export function AppLayout({
  activeTab,
  selectedLanguage,
  canGoBack,
  canGoForward,
  viewerRole,
  accountLabel,
  adminPortalOnly,
  children,
  onNavigate,
  onLanguageChange,
  onBack,
  onForward,
  onOpenLogin,
  onLogout
}: AppLayoutProps) {
  const { t } = useI18n();

  function handleNavigationClick(event: MouseEvent<HTMLAnchorElement>, tab: TabId) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onNavigate(tab);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <div className="brand-mark">EC</div>
          <div>
            <h1>EduCareer</h1>
            <p>{t('brand.tagline')}</p>
          </div>
        </div>

        <div className="nav-area">
          {!adminPortalOnly && (
            <>
              <nav className="nav-tabs" aria-label={t('aria.mainNavigation')}>
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={routeForTab(tab.id)}
                    className={activeTab === tab.id ? 'active' : ''}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    onClick={(event) => handleNavigationClick(event, tab.id)}
                  >
                    <Icon name={tab.icon} />
                    {t(`nav.${tab.id}`)}
                  </a>
                ))}

                <label className="language-picker">
                  <Icon name="globe" />
                  <select
                    aria-label={t('aria.selectLanguage')}
                    value={selectedLanguage}
                    onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
                  >
                    {languages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>
              </nav>

              <div className="movement-controls" aria-label={t('aria.movementControls')}>
                <button
                  className="secondary movement-button"
                  type="button"
                  onClick={onBack}
                  disabled={!canGoBack}
                  aria-label={t('actions.back')}
                  title={t('actions.back')}
                >
                  <Icon name="back" />
                </button>
                <button
                  className="secondary movement-button"
                  type="button"
                  onClick={onForward}
                  disabled={!canGoForward}
                  aria-label={t('actions.forward')}
                  title={t('actions.forward')}
                >
                  <Icon name="forward" />
                </button>
              </div>
            </>
          )}

          <div className="session-controls" aria-label={t('aria.accountControls')}>
            <span className={`session-pill session-${viewerRole}`}>{accountLabel}</span>
            {viewerRole !== 'visitor' && (
              <a
                href={routeForTab('portal')}
                className={activeTab === 'portal' ? 'session-link active' : 'session-link'}
                aria-current={activeTab === 'portal' ? 'page' : undefined}
                onClick={(event) => handleNavigationClick(event, 'portal')}
              >
                <Icon name="admin" />
                {t('actions.portal')}
              </a>
            )}
            {viewerRole === 'visitor' ? (
              <button className="secondary" type="button" onClick={onOpenLogin}>
                <Icon name="admin" />
                {t('actions.login')}
              </button>
            ) : (
              <button className="secondary" type="button" onClick={onLogout}>
                <Icon name="back" />
                {t('actions.logout')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <div>
          <strong>EduCareer</strong>
          <p>{t('footer.description')}</p>
        </div>
        <div>
          <p>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
          <p>{t('footer.phoneWhatsApp')}: <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></p>
          <p>{contact.address}</p>
        </div>
      </footer>
      <div className="page-end-actions">
        <button className="secondary back-to-top-button" type="button" onClick={scrollToTop}>
          <Icon name="back" />
          {t('actions.backToTop')}
        </button>
      </div>
    </div>
  );
}
