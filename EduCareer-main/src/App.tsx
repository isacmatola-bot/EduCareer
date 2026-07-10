import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  authenticateAccount,
  createAccount,
  seedDefaultAdmin,
  sessionForAccount
} from './auth';
import type { AdminRole, AuthSession, LoginForm, RegistrationMode, UserAccount, ViewerRole } from './auth';
import { AppLayout } from './components/AppLayout';
import { Notice } from './components/Notice';
import { WelcomeDialog } from './components/WelcomeDialog';
import {
  accountKey,
  blankCandidate,
  blankPartner,
  candidateKey,
  languageKey,
  partnerKey,
  sessionKey
} from './constants';
import { opportunities, programs } from './data';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { DashboardPage } from './features/admin/DashboardPage';
import {
  createTranslator,
  formatAccountLabel,
  formatAdminRole,
  I18nProvider,
  languageToHtmlLang,
  normalizeLanguage,
  type LanguageCode
} from './i18n';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { PartnerFormPage } from './pages/PartnerFormPage';
import { PortalPage } from './pages/PortalPage';
import type { AccountUpdatePatch, AdminAccountDraft } from './pages/PortalPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { RegisterPage } from './pages/RegisterPage';
import { isKnownRoute, routeForTab, tabFromPath } from './router';
import type { CandidateApplication, Opportunity, PartnerRequest, TabId } from './types';
import { makeId, readFromStorage, writeToStorage } from './utils/storage';

const blankLoginForm: LoginForm = {
  username: '',
  password: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromPath(window.location.pathname));
  const [historyIndex, setHistoryIndex] = useState<number>(() =>
    typeof window.history.state?.appIndex === 'number' ? window.history.state.appIndex : 0
  );
  const [maxHistoryIndex, setMaxHistoryIndex] = useState(historyIndex);
  const [candidateForm, setCandidateForm] = useState(blankCandidate);
  const [partnerForm, setPartnerForm] = useState(blankPartner);
  const [registerMode, setRegisterMode] = useState<RegistrationMode>('graduate');
  const [candidates, setCandidates] = useState<CandidateApplication[]>(() =>
    readFromStorage<CandidateApplication[]>(candidateKey, [])
  );
  const [partners, setPartners] = useState<PartnerRequest[]>(() => readFromStorage<PartnerRequest[]>(partnerKey, []));
  const [accounts, setAccounts] = useState<UserAccount[]>(() =>
    seedDefaultAdmin(readFromStorage<UserAccount[]>(accountKey, []))
  );
  const [session, setSession] = useState<AuthSession | null>(() => readFromStorage<AuthSession | null>(sessionKey, null));
  const [showWelcome, setShowWelcome] = useState<boolean>(() => !readFromStorage<AuthSession | null>(sessionKey, null));
  const [loginForm, setLoginForm] = useState<LoginForm>(blankLoginForm);
  const [loginError, setLoginError] = useState('');
  const [message, setMessage] = useState('');
  const [accessNoticeShown, setAccessNoticeShown] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(() =>
    normalizeLanguage(readFromStorage<string>(languageKey, 'en'))
  );
  const t = useMemo(() => createTranslator(selectedLanguage), [selectedLanguage]);

  const currentAccount = useMemo(() => {
    if (session?.mode !== 'account') {
      return null;
    }

    return accounts.find((account) => account.id === session.accountId) ?? null;
  }, [accounts, session]);

  const viewerRole: ViewerRole = currentAccount?.role ?? 'visitor';
  const isAdmin = currentAccount?.role === 'admin';
  const isDefaultAdmin = currentAccount?.role === 'admin' && currentAccount.adminRole === 'default_admin';

  useEffect(() => writeToStorage(candidateKey, candidates), [candidates]);
  useEffect(() => writeToStorage(partnerKey, partners), [partners]);
  useEffect(() => writeToStorage(accountKey, accounts), [accounts]);
  useEffect(() => writeToStorage(sessionKey, session), [session]);
  useEffect(() => writeToStorage(languageKey, selectedLanguage), [selectedLanguage]);
  useEffect(() => {
    document.documentElement.lang = languageToHtmlLang(selectedLanguage);
  }, [selectedLanguage]);
  useEffect(() => {
    if (session?.mode === 'account' && !currentAccount) {
      setSession(null);
      setShowWelcome(true);
    }
  }, [currentAccount, session]);
  useEffect(() => {
    if (accessNoticeShown || showWelcome || message || !session) {
      return;
    }

    if (session.mode === 'visitor') {
      setAccessNoticeShown(true);
      setMessage(t('messages.visitor'));
      return;
    }

    if (currentAccount) {
      setAccessNoticeShown(true);
      setMessage(t('messages.loggedInAs', { label: formatAccountLabel(currentAccount, t) }));
    }
  }, [accessNoticeShown, currentAccount, message, session, showWelcome, t]);
  useEffect(() => {
    if (!isDefaultAdmin || activeTab === 'portal' || activeTab === 'dashboard') {
      return;
    }

    window.history.replaceState({ appIndex: historyIndex, tab: 'portal' }, '', routeForTab('portal'));
    setActiveTab('portal');
  }, [activeTab, historyIndex, isDefaultAdmin]);
  useEffect(() => {
    const currentIndex = typeof window.history.state?.appIndex === 'number'
      ? window.history.state.appIndex
      : historyIndex;
    const currentTab = tabFromPath(window.location.pathname);

    if (!isKnownRoute(window.location.pathname)) {
      window.history.replaceState({ appIndex: currentIndex, tab: 'home' }, '', routeForTab('home'));
      setActiveTab('home');
      return;
    }

    window.history.replaceState({ appIndex: currentIndex, tab: currentTab }, '', routeForTab(currentTab));
  }, []);
  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      const nextTab = tabFromPath(window.location.pathname);
      const nextIndex = typeof event.state?.appIndex === 'number' ? event.state.appIndex : 0;

      setActiveTab(nextTab);
      setHistoryIndex(nextIndex);
      setMaxHistoryIndex((currentMax) => Math.max(currentMax, nextIndex));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const dashboard = useMemo(() => {
    const openOpportunities = opportunities.filter((item) => item.status === 'Open').length;
    return [
      { label: t('dashboard.metric.candidates'), value: candidates.length.toString() },
      { label: t('dashboard.metric.partners'), value: partners.length.toString() },
      { label: t('dashboard.metric.accounts'), value: accounts.length.toString() },
      { label: t('dashboard.metric.openOpportunities'), value: openOpportunities.toString() },
      { label: t('dashboard.metric.activePrograms'), value: programs.length.toString() }
    ];
  }, [accounts.length, candidates.length, partners.length, t]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < maxHistoryIndex;

  function navigateTo(tab: TabId) {
    const targetTab = isDefaultAdmin && tab !== 'portal' && tab !== 'dashboard' ? 'portal' : tab;

    if (targetTab === activeTab) return;

    const nextIndex = historyIndex + 1;

    window.history.pushState({ appIndex: nextIndex, tab: targetTab }, '', routeForTab(targetTab));
    setHistoryIndex(nextIndex);
    setMaxHistoryIndex(nextIndex);
    setActiveTab(targetTab);
  }

  function goBack() {
    if (!canGoBack) return;
    window.history.back();
  }

  function goForward() {
    if (!canGoForward) return;
    window.history.forward();
  }

  function startRegistration(mode: RegistrationMode) {
    setRegisterMode(mode);
    setShowWelcome(false);
    setSession((currentSession) => currentSession ?? { mode: 'visitor' });
    navigateTo('register');
  }

  function continueAsVisitor() {
    setSession({ mode: 'visitor' });
    setShowWelcome(false);
    setLoginError('');
    setAccessNoticeShown(true);
    setMessage(t('messages.visitor'));
  }

  function openLogin() {
    setShowWelcome(true);
    setLoginError('');
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = authenticateAccount(accounts, loginForm);

    if (!result.account) {
      setLoginError(result.error ?? t('messages.invalidLogin'));
      return;
    }

    setSession(sessionForAccount(result.account));
    setLoginForm(blankLoginForm);
    setLoginError('');
    setShowWelcome(false);
    setAccessNoticeShown(true);
    setMessage(t('messages.welcomeBack', { name: result.account.displayName }));
    navigateTo('portal');
  }

  function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = authenticateAccount(accounts, loginForm);

    if (!result.account || result.account.role !== 'admin') {
      setLoginError(t('messages.invalidAdminLogin'));
      return;
    }

    setSession(sessionForAccount(result.account));
    setLoginForm(blankLoginForm);
    setLoginError('');
    setShowWelcome(false);
    setAccessNoticeShown(true);
    setMessage(t('messages.adminAccess'));
    navigateTo('portal');
  }

  function logout() {
    setSession(null);
    setLoginForm(blankLoginForm);
    setLoginError('');
    setShowWelcome(true);
    setAccessNoticeShown(false);
    setMessage(t('messages.sessionClosed'));
    navigateTo('home');
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password, ...candidateProfile } = candidateForm;
    const result = createAccount(accounts, {
      role: 'graduate',
      username: candidateForm.username,
      password,
      displayName: candidateForm.fullName,
      email: candidateForm.email,
      phone: candidateForm.phone
    });

    if (!result.account || !result.accounts) {
      setMessage(result.error ?? t('messages.unableGraduate'));
      return;
    }

    const application: CandidateApplication = {
      id: makeId('candidate'),
      ...candidateProfile,
      username: result.account.username,
      createdAt: new Date().toISOString()
    };
    setAccounts(result.accounts);
    setSession(sessionForAccount(result.account));
    setCandidates((current) => [application, ...current]);
    setCandidateForm(blankCandidate);
    setShowWelcome(false);
    setAccessNoticeShown(true);
    setMessage(t('messages.graduateCreated'));
    navigateTo('portal');
  }

  function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password, ...partnerProfile } = partnerForm;
    const result = createAccount(accounts, {
      role: 'partner',
      username: partnerForm.username,
      password,
      displayName: partnerForm.organizationName,
      email: partnerForm.email,
      phone: partnerForm.phone
    });

    if (!result.account || !result.accounts) {
      setMessage(result.error ?? t('messages.unablePartner'));
      return;
    }

    const request: PartnerRequest = {
      id: makeId('partner'),
      ...partnerProfile,
      username: result.account.username,
      createdAt: new Date().toISOString()
    };
    setAccounts(result.accounts);
    setSession(sessionForAccount(result.account));
    setPartners((current) => [request, ...current]);
    setPartnerForm(blankPartner);
    setShowWelcome(false);
    setAccessNoticeShown(true);
    setMessage(t('messages.partnerCreated'));
    navigateTo('portal');
  }

  function applyForOpportunity(opportunity: Opportunity) {
    if (opportunity.status === 'Closed') {
      return;
    }

    if (viewerRole === 'visitor') {
      setRegisterMode('graduate');
      setMessage(t('messages.createGraduateFirst'));
      navigateTo('register');
      return;
    }

    if (viewerRole !== 'graduate') {
      setMessage(t('messages.graduateOnly'));
      return;
    }

    setMessage(t('messages.applicationIntent', { title: opportunity.title }));
  }

  function createAdminAccount(draft: AdminAccountDraft) {
    if (!isDefaultAdmin) {
      setMessage(t('messages.defaultAdminOnlyCreate'));
      return;
    }

    const result = createAccount(accounts, {
      role: 'admin',
      username: draft.username,
      password: draft.password,
      displayName: draft.displayName,
      email: draft.email,
      phone: draft.phone,
      adminRole: draft.adminRole
    });

    if (!result.account || !result.accounts) {
      setMessage(result.error ?? t('messages.unableAdmin'));
      return;
    }

    setAccounts(result.accounts);
    setMessage(t('messages.adminCreated', {
      name: result.account.displayName,
      role: formatAdminRole(result.account.adminRole as AdminRole, t)
    }));
  }

  function updateAccount(accountId: string, patch: AccountUpdatePatch) {
    if (!isDefaultAdmin) {
      setMessage(t('messages.defaultAdminOnlyEdit'));
      return;
    }

    if (accountId === currentAccount?.id && patch.status !== 'active') {
      setMessage(t('messages.defaultMustStayActive'));
      return;
    }

    setAccounts((currentAccounts) => currentAccounts.map((account) => {
      if (account.id !== accountId) {
        return account;
      }

      return {
        ...account,
        displayName: patch.displayName,
        email: patch.email,
        phone: patch.phone,
        status: account.id === 'admin-default' ? 'active' : patch.status,
        adminRole: account.id === 'admin-default' ? 'default_admin' : patch.adminRole
      };
    }));
    setMessage(t('messages.accountUpdated'));
  }

  function recoverAccount(accountId: string) {
    if (!isDefaultAdmin) {
      setMessage(t('messages.defaultAdminOnlyRecover'));
      return;
    }

    setAccounts((currentAccounts) => currentAccounts.map((account) => (
      account.id === accountId ? { ...account, status: 'active' } : account
    )));
    setMessage(t('messages.accountRecovered'));
  }

  function blockAccount(accountId: string) {
    if (!isDefaultAdmin) {
      setMessage(t('messages.defaultAdminOnlyBlock'));
      return;
    }

    if (accountId === currentAccount?.id || accountId === 'admin-default') {
      setMessage(t('messages.defaultCannotBlock'));
      return;
    }

    setAccounts((currentAccounts) => currentAccounts.map((account) => (
      account.id === accountId ? { ...account, status: 'disabled' } : account
    )));
    setMessage(t('messages.accountBlocked'));
  }

  function deleteAccount(accountId: string) {
    if (!isDefaultAdmin) {
      setMessage(t('messages.defaultAdminOnlyDelete'));
      return;
    }

    if (accountId === currentAccount?.id || accountId === 'admin-default') {
      setMessage(t('messages.defaultCannotDelete'));
      return;
    }

    const shouldDelete = window.confirm(t('messages.confirmDelete'));
    if (!shouldDelete) {
      return;
    }

    setAccounts((currentAccounts) => currentAccounts.filter((account) => account.id !== accountId));
    setMessage(t('messages.accountDeleted'));
  }

  return (
    <I18nProvider language={selectedLanguage}>
      <AppLayout
        activeTab={activeTab}
        selectedLanguage={selectedLanguage}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        viewerRole={viewerRole}
        accountLabel={currentAccount ? formatAccountLabel(currentAccount, t) : t('role.visitor')}
        adminPortalOnly={isDefaultAdmin}
        onNavigate={navigateTo}
        onLanguageChange={setSelectedLanguage}
        onBack={goBack}
        onForward={goForward}
        onOpenLogin={openLogin}
        onLogout={logout}
      >
        <Notice message={message} onDismiss={() => setMessage('')} />

        {showWelcome && (
          <WelcomeDialog
            loginForm={loginForm}
            loginError={loginError}
            onLoginFormChange={setLoginForm}
            onLogin={submitLogin}
            onContinueAsVisitor={continueAsVisitor}
            onStartRegistration={startRegistration}
          />
        )}

        {activeTab === 'home' && <HomePage onNavigate={navigateTo} onStartRegistration={startRegistration} />}
        {activeTab === 'about' && <AboutPage onNavigate={navigateTo} />}
        {activeTab === 'programs' && <ProgramsPage />}
        {activeTab === 'opportunities' && (
          <OpportunitiesPage
            viewerRole={viewerRole}
            onNavigate={navigateTo}
            onApplyOpportunity={applyForOpportunity}
          />
        )}
        {activeTab === 'register' && (
          <RegisterPage
            mode={registerMode}
            candidateForm={candidateForm}
            partnerForm={partnerForm}
            setMode={setRegisterMode}
            setCandidateForm={setCandidateForm}
            setPartnerForm={setPartnerForm}
            onCandidateSubmit={submitCandidate}
            onPartnerSubmit={submitPartner}
          />
        )}
        {activeTab === 'partners' && (
          <PartnerFormPage form={partnerForm} setForm={setPartnerForm} onSubmit={submitPartner} />
        )}
        {activeTab === 'contact' && <ContactPage onNavigate={navigateTo} />}
        {activeTab === 'portal' && (
          <PortalPage
            account={currentAccount}
            accounts={accounts}
            onNavigate={navigateTo}
            onOpenLogin={openLogin}
            onCreateAdminAccount={createAdminAccount}
            onUpdateAccount={updateAccount}
            onRecoverAccount={recoverAccount}
            onBlockAccount={blockAccount}
            onDeleteAccount={deleteAccount}
          />
        )}
        {activeTab === 'dashboard' && (
          isAdmin ? (
            <DashboardPage
              stats={dashboard}
              candidates={candidates}
              partners={partners}
              currentAdmin={currentAccount}
            />
          ) : (
            <AdminLoginPage
              adminUsername={loginForm.username}
              adminCode={loginForm.password}
              adminError={loginError}
              setAdminUsername={(username) => setLoginForm((current) => ({ ...current, username }))}
              setAdminCode={(password) => setLoginForm((current) => ({ ...current, password }))}
              onSubmit={submitAdminLogin}
            />
          )
        )}
      </AppLayout>
    </I18nProvider>
  );
}
