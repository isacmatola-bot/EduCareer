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
        <div className="header-identity">
          <div className="movement-controls" aria-label={t('aria.movementControls')}>
            <button className="secondary movement-button" type="button" onClick={onBack} disabled={!canGoBack} aria-label={t('actions.back')} title={t('actions.back')}>
              <Icon name="back" />
            </button>
            <button className="secondary movement-button" type="button" onClick={onForward} disabled={!canGoForward} aria-label={t('actions.forward')} title={t('actions.forward')}>
              <Icon name="forward" />
            </button>
          </div>
          <div className="brand-block">
            <div className="brand-mark">EC</div>
            <div>
              <h1>EduCareer</h1>
              <p>{t('brand.tagline')}</p>
            </div>
          </div>
          <span className={`session-pill session-${viewerRole}`}>{accountLabel}</span>
        </div>

        <div className="nav-area">
          <div className="header-utility-row">
            <label className="language-picker icon-control" title={t('aria.selectLanguage')}>
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
            {viewerRole === 'visitor' ? (
              <button className="secondary header-session-button icon-control" type="button" onClick={onOpenLogin} aria-label={t('actions.login')} title={t('actions.login')}>
                <Icon name="login" />
              </button>
            ) : (
              <button className="secondary header-session-button icon-control" type="button" onClick={onLogout} aria-label={t('actions.logout')} title={t('actions.logout')}>
                <Icon name="logout" />
              </button>
            )}
          </div>

          <div className="main-menu-row">
            {!adminPortalOnly && (
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
              </nav>
            )}

            {viewerRole === 'admin' && (
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
