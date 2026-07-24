import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  authenticateAccount,
  createAccount,
  seedDefaultAdmin,
  sessionForAccount
} from './auth';
import { canDeleteAccount, canManageAccount, canManageOperations } from './auth';
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
  opportunityKey,
  opportunityApplicationKey,
  partnerKey,
  programKey,
  sessionKey
} from './constants';
import { opportunities as initialOpportunities, programs as initialPrograms } from './data';
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
import {
  applyToSupabaseOpportunity,
  createSupabaseOpportunity,
  createSupabaseProgram,
  createSupabaseAdminAccount,
  deleteSupabaseAccountProfile,
  loadSupabaseSnapshot,
  registerSupabaseAccount,
  signInSupabaseAccount,
  signOutSupabaseAccount,
  updateSupabaseOpportunity,
  updateSupabaseProgram,
  updateSupabaseAccountProfile
} from './services/supabaseStore';
import { isSupabaseConfigured } from './services/supabaseClient';
import type { CandidateApplication, Opportunity, OpportunityApplication, PartnerRequest, Program, TabId } from './types';
import { makeId, readFromStorage, writeToStorage } from './utils/storage';

const blankLoginForm: LoginForm = {
  username: '',
  password: ''
};

function translateAuthError(
  error: string | undefined,
  t: (key: string) => string,
  fallbackKey: string
): string {
  if (!error) {
    return t(fallbackKey);
  }

  const authErrorKeys: Record<string, string> = {
    'Invalid username or password.': 'messages.invalidLogin',
    'Username must contain at least 3 characters.': 'messages.usernameShort',
    'Password must contain at least 8 characters.': 'messages.passwordShort',
    'This username is already registered. Choose another username or log in.': 'messages.usernameTaken',
    'This account is disabled. Contact EduCareer support.': 'messages.accountDisabled'
  };

  return t(authErrorKeys[error] ?? fallbackKey);
}

function getErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function mergeAccount(accounts: UserAccount[], account: UserAccount): UserAccount[] {
  const existing = accounts.some((item) => item.id === account.id);

  if (existing) {
    return accounts.map((item) => (item.id === account.id ? account : item));
  }

  return [account, ...accounts];
}

function landingTabForAccount(_account: UserAccount): TabId {
  return 'home';
}

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
  const [programs, setPrograms] = useState<Program[]>(() => readFromStorage<Program[]>(programKey, initialPrograms));
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() =>
    readFromStorage<Opportunity[]>(opportunityKey, initialOpportunities)
  );
  const [opportunityApplications, setOpportunityApplications] = useState<OpportunityApplication[]>(() =>
    readFromStorage<OpportunityApplication[]>(opportunityApplicationKey, [])
  );
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
  const canManageAccounts = canManageOperations(currentAccount);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      writeToStorage(candidateKey, candidates);
    }
  }, [candidates]);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      writeToStorage(partnerKey, partners);
    }
  }, [partners]);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      writeToStorage(accountKey, accounts);
    }
  }, [accounts]);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      writeToStorage(sessionKey, session);
    }
  }, [session]);
  useEffect(() => writeToStorage(languageKey, selectedLanguage), [selectedLanguage]);
  useEffect(() => {
    if (!isSupabaseConfigured) writeToStorage(programKey, programs);
  }, [programs]);
  useEffect(() => {
    if (!isSupabaseConfigured) writeToStorage(opportunityKey, opportunities);
  }, [opportunities]);
  useEffect(() => {
    if (!isSupabaseConfigured) writeToStorage(opportunityApplicationKey, opportunityApplications);
  }, [opportunityApplications]);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isCancelled = false;

    loadSupabaseSnapshot()
      .then((snapshot) => {
        if (isCancelled) {
          return;
        }

        setAccounts(snapshot.accounts);
        setCandidates(snapshot.candidates);
        setPartners(snapshot.partners);
        setPrograms(snapshot.programs);
        setOpportunities(snapshot.opportunities);
        setSession(snapshot.session);
        setShowWelcome(!snapshot.session);
      })
      .catch((error) => {
        if (!isCancelled) {
          setMessage(getErrorMessage(error) ?? 'Unable to load Supabase data.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);
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
    if (!currentAccount || currentAccount.role === 'admin' || activeTab !== 'portal') {
      return;
    }

    const targetTab = landingTabForAccount(currentAccount);
    window.history.replaceState({ appIndex: historyIndex, tab: targetTab }, '', routeForTab(targetTab));
    setActiveTab(targetTab);
  }, [activeTab, currentAccount, historyIndex]);
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);
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
  }, [accounts.length, candidates.length, opportunities, partners.length, programs.length, t]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < maxHistoryIndex;

  function navigateTo(tab: TabId) {
    const targetTab = tab;

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

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSupabaseConfigured) {
      try {
        const account = await signInSupabaseAccount(loginForm);
        const snapshot = await loadSupabaseSnapshot();
        setAccounts(snapshot.accounts);
        setCandidates(snapshot.candidates);
        setPartners(snapshot.partners);
        setPrograms(snapshot.programs);
        setOpportunities(snapshot.opportunities);
        setSession(snapshot.session ?? sessionForAccount(account));
        setLoginForm(blankLoginForm);
        setLoginError('');
        setShowWelcome(false);
        setAccessNoticeShown(true);
        setMessage(t('messages.welcomeBack', { name: account.displayName }));
        navigateTo(landingTabForAccount(account));
      } catch (error) {
        setLoginError(translateAuthError(getErrorMessage(error), t, 'messages.invalidLogin'));
      }

      return;
    }

    const result = authenticateAccount(accounts, loginForm);

    if (!result.account) {
      setLoginError(translateAuthError(result.error, t, 'messages.invalidLogin'));
      return;
    }

    setSession(sessionForAccount(result.account));
    setLoginForm(blankLoginForm);
    setLoginError('');
    setShowWelcome(false);
    setAccessNoticeShown(true);
    setMessage(t('messages.welcomeBack', { name: result.account.displayName }));
    navigateTo(landingTabForAccount(result.account));
  }

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSupabaseConfigured) {
      try {
        const account = await signInSupabaseAccount(loginForm);

        if (account.role !== 'admin') {
          await signOutSupabaseAccount();
          setLoginError(t('messages.invalidAdminLogin'));
          return;
        }

        const snapshot = await loadSupabaseSnapshot();
        setAccounts(snapshot.accounts);
        setCandidates(snapshot.candidates);
        setPartners(snapshot.partners);
        setPrograms(snapshot.programs);
        setOpportunities(snapshot.opportunities);
        setSession(snapshot.session ?? sessionForAccount(account));
        setLoginForm(blankLoginForm);
        setLoginError('');
        setShowWelcome(false);
        setAccessNoticeShown(true);
        setMessage(t('messages.adminAccess'));
        navigateTo('home');
      } catch (error) {
        setLoginError(translateAuthError(getErrorMessage(error), t, 'messages.invalidAdminLogin'));
      }

      return;
    }

    const result = authenticateAccount(accounts, loginForm);

    if (!result.account || result.account.role !== 'admin') {
      setLoginError(translateAuthError(result.error, t, 'messages.invalidAdminLogin'));
      return;
    }

    setSession(sessionForAccount(result.account));
    setLoginForm(blankLoginForm);
    setLoginError('');
    setShowWelcome(false);
    setAccessNoticeShown(true);
    setMessage(t('messages.adminAccess'));
    navigateTo('home');
  }

  async function logout() {
    if (isSupabaseConfigured) {
      try {
        await signOutSupabaseAccount();
      } catch (error) {
        setMessage(getErrorMessage(error) ?? t('messages.sessionClosed'));
      }
    }

    setSession(null);
    setLoginForm(blankLoginForm);
    setLoginError('');
    setShowWelcome(true);
    setAccessNoticeShown(false);
    setMessage(t('messages.sessionClosed'));
    navigateTo('home');
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password, ...candidateProfile } = candidateForm;

    if (isSupabaseConfigured) {
      try {
        const registration = await registerSupabaseAccount({
          role: 'graduate',
          username: candidateForm.username,
          password,
          displayName: candidateForm.fullName,
          email: candidateForm.email,
          phone: candidateForm.phone,
          candidate: candidateProfile
        });
        const { account } = registration;
        const application: CandidateApplication = {
          id: makeId('candidate'),
          ...candidateProfile,
          username: account.username,
          createdAt: new Date().toISOString()
        };

        if (registration.requiresEmailConfirmation) {
          setCandidateForm(blankCandidate);
          setSession(null);
          setShowWelcome(false);
          setAccessNoticeShown(true);
          setMessage(t('messages.confirmEmailGraduate'));
          navigateTo('home');
          return;
        }

        setAccounts((currentAccounts) => mergeAccount(currentAccounts, account));
        setSession(sessionForAccount(account));
        setCandidates((current) => [application, ...current]);
        setCandidateForm(blankCandidate);
        setShowWelcome(false);
        setAccessNoticeShown(true);
        setMessage(t('messages.graduateCreated'));
        navigateTo('opportunities');
      } catch (error) {
        setMessage(translateAuthError(getErrorMessage(error), t, 'messages.unableGraduate'));
      }

      return;
    }

    const result = createAccount(accounts, {
      role: 'graduate',
      username: candidateForm.username,
      password,
      displayName: candidateForm.fullName,
      email: candidateForm.email,
      phone: candidateForm.phone
    });

    if (!result.account || !result.accounts) {
      setMessage(translateAuthError(result.error, t, 'messages.unableGraduate'));
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
    navigateTo('opportunities');
  }

  async function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password, ...partnerProfile } = partnerForm;

    if (isSupabaseConfigured) {
      try {
        const registration = await registerSupabaseAccount({
          role: 'partner',
          username: partnerForm.username,
          password,
          displayName: partnerForm.organizationName,
          email: partnerForm.email,
          phone: partnerForm.phone,
          partner: partnerProfile
        });
        const { account } = registration;
        const request: PartnerRequest = {
          id: makeId('partner'),
          ...partnerProfile,
          username: account.username,
          createdAt: new Date().toISOString()
        };

        if (registration.requiresEmailConfirmation) {
          setPartnerForm(blankPartner);
          setSession(null);
          setShowWelcome(false);
          setAccessNoticeShown(true);
          setMessage(t('messages.confirmEmailPartner'));
          navigateTo('home');
          return;
        }

        setAccounts((currentAccounts) => mergeAccount(currentAccounts, account));
        setSession(sessionForAccount(account));
        setPartners((current) => [request, ...current]);
        setPartnerForm(blankPartner);
        setShowWelcome(false);
        setAccessNoticeShown(true);
        setMessage(t('messages.partnerCreated'));
        navigateTo('home');
      } catch (error) {
        setMessage(translateAuthError(getErrorMessage(error), t, 'messages.unablePartner'));
      }

      return;
    }

    const result = createAccount(accounts, {
      role: 'partner',
      username: partnerForm.username,
      password,
      displayName: partnerForm.organizationName,
      email: partnerForm.email,
      phone: partnerForm.phone
    });

    if (!result.account || !result.accounts) {
      setMessage(translateAuthError(result.error, t, 'messages.unablePartner'));
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
    navigateTo('home');
  }

  async function applyForOpportunity(opportunity: Opportunity) {
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

    if (currentAccount?.status !== 'active') {
      setMessage(t('messages.accountPending'));
      return;
    }

    if (isSupabaseConfigured) {
      try {
        await applyToSupabaseOpportunity(opportunity.id);
        setMessage(t('messages.applicationSubmitted', { title: opportunity.title }));
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setMessage(errorMessage === 'You have already applied for this opportunity.'
          ? t('messages.applicationAlreadySubmitted')
          : errorMessage ?? t('messages.applicationUnable'));
      }
      return;
    }

    const alreadyApplied = opportunityApplications.some((application) =>
      application.opportunityId === opportunity.id && application.accountId === currentAccount.id
    );
    if (alreadyApplied) {
      setMessage(t('messages.applicationAlreadySubmitted'));
      return;
    }

    setOpportunityApplications((current) => [{
      id: makeId('opportunity-application'),
      opportunityId: opportunity.id,
      accountId: currentAccount.id,
      status: 'submitted',
      createdAt: new Date().toISOString()
    }, ...current]);
    setMessage(t('messages.applicationSubmitted', { title: opportunity.title }));
  }

  async function createProgram(program: Program) {
    try {
      const savedProgram = isSupabaseConfigured ? await createSupabaseProgram(program) : program;
      setPrograms((current) => [savedProgram, ...current]);
      setMessage(t('messages.programSaved'));
    } catch (error) {
      setMessage(getErrorMessage(error) ?? t('messages.contentUnable'));
    }
  }

  async function updateProgram(program: Program) {
    try {
      const savedProgram = isSupabaseConfigured ? await updateSupabaseProgram(program) : program;
      setPrograms((current) => current.map((item) => item.id === savedProgram.id ? savedProgram : item));
      setMessage(t('messages.programSaved'));
    } catch (error) {
      setMessage(getErrorMessage(error) ?? t('messages.contentUnable'));
    }
  }

  async function createOpportunity(opportunity: Opportunity) {
    try {
      const savedOpportunity = isSupabaseConfigured ? await createSupabaseOpportunity(opportunity) : opportunity;
      setOpportunities((current) => [savedOpportunity, ...current]);
      setMessage(t('messages.opportunitySaved'));
    } catch (error) {
      setMessage(getErrorMessage(error) ?? t('messages.contentUnable'));
    }
  }

  async function updateOpportunity(opportunity: Opportunity) {
    try {
      const savedOpportunity = isSupabaseConfigured ? await updateSupabaseOpportunity(opportunity) : opportunity;
      setOpportunities((current) => current.map((item) => item.id === savedOpportunity.id ? savedOpportunity : item));
      setMessage(t('messages.opportunitySaved'));
    } catch (error) {
      setMessage(getErrorMessage(error) ?? t('messages.contentUnable'));
    }
  }

  async function createAdminAccount(draft: AdminAccountDraft) {
    if (!isDefaultAdmin) {
      setMessage(t('messages.defaultAdminOnlyCreate'));
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const account = await createSupabaseAdminAccount({
          role: 'admin',
          username: draft.username,
          password: draft.password,
          displayName: draft.displayName,
          email: draft.email,
          phone: draft.phone,
          adminRole: draft.adminRole
        });

        setAccounts((currentAccounts) => mergeAccount(currentAccounts, account));
        setMessage(t('messages.adminCreated', {
          name: account.displayName,
          role: formatAdminRole(account.adminRole as AdminRole, t)
        }));
      } catch (error) {
        setMessage(translateAuthError(getErrorMessage(error), t, 'messages.unableAdmin'));
      }

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
      setMessage(translateAuthError(result.error, t, 'messages.unableAdmin'));
      return;
    }

    setAccounts(result.accounts);
    setMessage(t('messages.adminCreated', {
      name: result.account.displayName,
      role: formatAdminRole(result.account.adminRole as AdminRole, t)
    }));
  }

  async function updateAccount(accountId: string, patch: AccountUpdatePatch) {
    const targetAccount = accounts.find((account) => account.id === accountId);
    const isDefaultAdminTarget = targetAccount?.adminRole === 'default_admin' || accountId === 'admin-default';

    if (!canManageAccounts) {
      setMessage(t('messages.defaultAdminOnlyEdit'));
      return;
    }

    if (!canManageAccount(currentAccount, targetAccount)) {
      setMessage(t('messages.defaultAdminOnlyEditAdmins'));
      return;
    }

    if (isDefaultAdminTarget && patch.status !== 'active') {
      setMessage(t('messages.defaultMustStayActive'));
      return;
    }

    if (isSupabaseConfigured) {
      try {
        await updateSupabaseAccountProfile(accountId, {
          displayName: patch.displayName,
          email: patch.email,
          phone: patch.phone,
          status: isDefaultAdminTarget ? 'active' : patch.status,
          adminRole: isDefaultAdminTarget ? 'default_admin' : patch.adminRole
        });
      } catch (error) {
        setMessage(getErrorMessage(error) ?? t('messages.defaultAdminOnlyEdit'));
        return;
      }
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
        status: account.adminRole === 'default_admin' || account.id === 'admin-default' ? 'active' : patch.status,
        adminRole: account.adminRole === 'default_admin' || account.id === 'admin-default' ? 'default_admin' : patch.adminRole
      };
    }));
    setMessage(t('messages.accountUpdated'));
  }

  async function recoverAccount(accountId: string) {
    if (!canManageAccounts) {
      setMessage(t('messages.defaultAdminOnlyRecover'));
      return;
    }

    const target = accounts.find((account) => account.id === accountId);
    if (!canManageAccount(currentAccount, target)) {
      setMessage(t('messages.defaultAdminOnlyEditAdmins'));
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const target = accounts.find((account) => account.id === accountId);
        await updateSupabaseAccountProfile(accountId, {
          displayName: target?.displayName,
          email: target?.email,
          phone: target?.phone,
          status: 'active',
          adminRole: target?.adminRole
        });
      } catch (error) {
        setMessage(getErrorMessage(error) ?? t('messages.defaultAdminOnlyRecover'));
        return;
      }
    }

    setAccounts((currentAccounts) => currentAccounts.map((account) => (
      account.id === accountId ? { ...account, status: 'active' } : account
    )));
    setMessage(t('messages.accountRecovered'));
  }

  async function blockAccount(accountId: string) {
    const targetAccount = accounts.find((account) => account.id === accountId);

    if (!canManageAccounts) {
      setMessage(t('messages.defaultAdminOnlyBlock'));
      return;
    }

    if (!canManageAccount(currentAccount, targetAccount)) {
      setMessage(t('messages.defaultAdminOnlyEditAdmins'));
      return;
    }

    if (accountId === currentAccount?.id || accountId === 'admin-default' || targetAccount?.adminRole === 'default_admin') {
      setMessage(t('messages.defaultCannotBlock'));
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const target = accounts.find((account) => account.id === accountId);
        await updateSupabaseAccountProfile(accountId, {
          displayName: target?.displayName,
          email: target?.email,
          phone: target?.phone,
          status: 'disabled',
          adminRole: target?.adminRole
        });
      } catch (error) {
        setMessage(getErrorMessage(error) ?? t('messages.defaultAdminOnlyBlock'));
        return;
      }
    }

    setAccounts((currentAccounts) => currentAccounts.map((account) => (
      account.id === accountId ? { ...account, status: 'disabled' } : account
    )));
    setMessage(t('messages.accountBlocked'));
  }

  async function deleteAccount(accountId: string) {
    const targetAccount = accounts.find((account) => account.id === accountId);

    if (!canDeleteAccount(currentAccount, targetAccount)) {
      setMessage(t('messages.defaultAdminOnlyDelete'));
      return;
    }

    if (accountId === currentAccount?.id || accountId === 'admin-default' || targetAccount?.adminRole === 'default_admin') {
      setMessage(t('messages.defaultCannotDelete'));
      return;
    }

    const shouldDelete = window.confirm(t('messages.confirmDelete'));
    if (!shouldDelete) {
      return;
    }

    if (isSupabaseConfigured) {
      try {
        await deleteSupabaseAccountProfile(accountId);
      } catch (error) {
        setMessage(getErrorMessage(error) ?? t('messages.defaultAdminOnlyDelete'));
        return;
      }
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
        adminPortalOnly={false}
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
        {activeTab === 'programs' && (
          <ProgramsPage
            programs={programs}
            canManage={canManageAccounts}
            onCreate={createProgram}
            onUpdate={updateProgram}
          />
        )}
        {activeTab === 'opportunities' && (
          <OpportunitiesPage
            opportunities={opportunities}
            canManage={canManageAccounts}
            canApply={viewerRole === 'graduate' && currentAccount?.status === 'active'}
            onCreate={createOpportunity}
            onUpdate={updateOpportunity}
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
        {activeTab === 'portal' && isAdmin && (
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
