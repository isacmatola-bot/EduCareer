import { FormEvent, useEffect, useMemo, useState } from 'react';
import { beneficiaries, contact, metrics, objectives, opportunities, programs } from './data';
import type { CandidateApplication, PartnerRequest, TabId } from './types';
import { makeId, readFromStorage, writeToStorage } from './utils/storage';

const candidateKey = 'educareer:candidates';
const partnerKey = 'educareer:partners';
const adminAuthKey = 'educareer:admin-auth';
const languageKey = 'educareer:language';
const userRoleKey = 'educareer:user-role';
const adminAccessCode = 'EduCareer@2026';

type IconName =
  | 'home'
  | 'about'
  | 'programs'
  | 'opportunities'
  | 'bridge'
  | 'vision'
  | 'mission'
  | 'seminar'
  | 'placement'
  | 'mentor'
  | 'teachers'
  | 'ratio'
  | 'region'
  | 'partner'
  | 'contact'
  | 'admin'
  | 'globe'
  | 'back'
  | 'forward'
  | 'impact';

type UserRole = 'visitor' | 'graduate' | 'partner' | 'admin';

const publicTabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'about', label: 'About Us', icon: 'about' },
  { id: 'programs', label: 'Programs', icon: 'programs' },
  { id: 'opportunities', label: 'Opportunities', icon: 'opportunities' }
];

const privateTabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'portal', label: 'My EduCareer', icon: 'teachers' }
];

const languages = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' }
];

const blankCandidate = {
  fullName: '',
  email: '',
  phone: '',
  province: 'Sofala',
  institution: '',
  qualification: '',
  teachingArea: '',
  preferredPrograms: ['EduLink – Career Connection Platform'],
  motivation: ''
};

const blankPartner = {
  organizationName: '',
  contactPerson: '',
  email: '',
  phone: '',
  organizationType: 'Public School',
  supportNeeded: ''
};

const blankAccountForm = {
  role: 'graduate' as UserRole,
  fullName: '',
  organizationName: '',
  email: '',
  phone: ''
};


type AdminRole =
  | 'default_setup'
  | 'ceo'
  | 'it'
  | 'director'
  | 'finance'
  | 'hr'
  | 'statistics'
  | 'programs'
  | 'opportunities'
  | 'partnerships'
  | 'support'
  | 'subscriptions';

type AdminAccountStatus = 'active' | 'blocked';

type AdminAccountForm = {
  fullName: string;
  email: string;
  role: AdminRole;
  accessCode: string;
};

type AdminAccount = AdminAccountForm & {
  id: string;
  status: AdminAccountStatus;
  createdAt: string;
};

const adminAccountsKey = 'educareer:admin-accounts';
const currentAdminRoleKey = 'educareer:current-admin-role';
const currentAdminLabelKey = 'educareer:current-admin-label';

const blankAdminAccount: AdminAccountForm = {
  fullName: '',
  email: '',
  role: 'ceo',
  accessCode: ''
};

const adminRoleOptions: { role: AdminRole; label: string; scope: string }[] = [
  { role: 'ceo', label: 'CEO Admin', scope: 'Full access' },
  { role: 'it', label: 'IT Admin', scope: 'Full access' },
  { role: 'director', label: 'Director Admin', scope: 'Full access' },
  { role: 'finance', label: 'Finance Admin', scope: 'Finance, subscriptions, and payment records' },
  { role: 'hr', label: 'HR Admin', scope: 'Graduate, partner, and account compliance' },
  { role: 'statistics', label: 'Statistics Admin', scope: 'Reports, analytics, and exports' },
  { role: 'programs', label: 'Programs Admin', scope: 'Programs, gallery, and activity posts' },
  { role: 'opportunities', label: 'Opportunities Admin', scope: 'Issue, edit, and close opportunities' },
  { role: 'partnerships', label: 'Partnerships Admin', scope: 'Partner request validation' },
  { role: 'support', label: 'Account Recovery Admin', scope: 'Lost account recovery and user support' },
  { role: 'subscriptions', label: 'Subscriptions Admin', scope: 'Subscription management' }
];

function getAdminRoleLabel(role: AdminRole): string {
  if (role === 'default_setup') return 'Default Setup Admin';
  return adminRoleOptions.find((option) => option.role === role)?.label ?? 'Admin';
}

function isFullAdminRole(role: AdminRole): boolean {
  return role === 'ceo' || role === 'it' || role === 'director';
}

function getAdminRolePermissions(role: AdminRole): string[] {
  if (role === 'default_setup') {
    return [
      'Read dashboard overview',
      'View graduate and partner request summaries',
      'Create official EduCareer admin accounts',
      'Cannot approve, reject, edit, block, publish, or close operational records'
    ];
  }

  if (isFullAdminRole(role)) {
    return [
      'Full operational control',
      'Create and manage admin accounts',
      'Approve, reject, block, or validate user and partner records',
      'Issue, edit, and close opportunities',
      'Manage all EduCareer programs',
      'Manage activity gallery and posts',
      'Manage account recovery',
      'Manage subscriptions and institutional records',
      'View and manage reports across all departments'
    ];
  }

  const limitedPermissions: Record<AdminRole, string[]> = {
    default_setup: [],
    ceo: [],
    it: [],
    director: [],
    finance: [
      'Can manage finance and subscription records',
      'Can view other administrative modules in read-only mode'
    ],
    hr: [
      'Can manage graduate accounts, partner accounts, and compliance cases',
      'Can view other administrative modules in read-only mode'
    ],
    statistics: [
      'Can manage statistics, reports, analytics, and exports',
      'Can view other administrative modules in read-only mode'
    ],
    programs: [
      'Can manage EduCareer programs, gallery posts, and activity updates',
      'Can view other administrative modules in read-only mode'
    ],
    opportunities: [
      'Can issue, edit, and close opportunities',
      'Can view other administrative modules in read-only mode'
    ],
    partnerships: [
      'Can approve, reject, and review partner requests',
      'Can view other administrative modules in read-only mode'
    ],
    support: [
      'Can assist lost account recovery and user support cases',
      'Can view other administrative modules in read-only mode'
    ],
    subscriptions: [
      'Can manage subscription plans and subscriber status',
      'Can view other administrative modules in read-only mode'
    ]
  };

  return limitedPermissions[role];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [history, setHistory] = useState<TabId[]>(['home']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [candidateForm, setCandidateForm] = useState(blankCandidate);
  const [partnerForm, setPartnerForm] = useState(blankPartner);
  const [candidates, setCandidates] = useState<CandidateApplication[]>(() =>
    readFromStorage<CandidateApplication[]>(candidateKey, [])
  );
  const [partners, setPartners] = useState<PartnerRequest[]>(() => readFromStorage<PartnerRequest[]>(partnerKey, []));
  const [message, setMessage] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => readFromStorage<boolean>(adminAuthKey, false));
  const [adminError, setAdminError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => readFromStorage<string>(languageKey, 'en'));
  const [userRole, setUserRole] = useState<UserRole>(() => readFromStorage<UserRole>(userRoleKey, 'visitor'));
  const [showWelcome, setShowWelcome] = useState<boolean>(() => !readFromStorage<boolean>('educareer:welcome-seen', false));
  const [loginRole, setLoginRole] = useState<UserRole>('graduate');
  const [accountForm, setAccountForm] = useState(blankAccountForm);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [confirmationDialog, setConfirmationDialog] = useState<{ title: string; body: string } | null>(null);
  const [appliedOpportunityIds, setAppliedOpportunityIds] = useState<string[]>(() =>
    readFromStorage<string[]>('educareer:applied-opportunity-ids', [])
  );
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>(() =>
    readFromStorage<AdminAccount[]>(adminAccountsKey, [])
  );
  const [currentAdminRole, setCurrentAdminRole] = useState<AdminRole>(() =>
    readFromStorage<AdminRole>(currentAdminRoleKey, 'default_setup')
  );
  const [currentAdminLabel, setCurrentAdminLabel] = useState<string>(() =>
    readFromStorage<string>(currentAdminLabelKey, 'Default Setup Admin')
  );
  const [adminAccountForm, setAdminAccountForm] = useState<AdminAccountForm>(blankAdminAccount);

  useEffect(() => writeToStorage(candidateKey, candidates), [candidates]);
  useEffect(() => writeToStorage(partnerKey, partners), [partners]);
  useEffect(() => writeToStorage(adminAuthKey, isAdmin), [isAdmin]);
  useEffect(() => writeToStorage(languageKey, selectedLanguage), [selectedLanguage]);
  useEffect(() => writeToStorage(userRoleKey, userRole), [userRole]);
  useEffect(() => writeToStorage(adminAccountsKey, adminAccounts), [adminAccounts]);
  useEffect(() => writeToStorage(currentAdminRoleKey, currentAdminRole), [currentAdminRole]);
  useEffect(() => writeToStorage(currentAdminLabelKey, currentAdminLabel), [currentAdminLabel]);

  useEffect(() => {
    document.documentElement.lang = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    if (userRole === 'admin' && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      setHistory(['dashboard']);
      setHistoryIndex(0);
    }
  }, [userRole, activeTab]);

  const isVisitor = userRole === 'visitor';
  const isLoggedIn = userRole !== 'visitor';
  const canShareActivity = userRole === 'graduate' || userRole === 'partner' || userRole === 'admin';
  const canAccessAdmin = userRole === 'admin';

  const adminTabs = [{ id: 'dashboard' as TabId, label: 'Admin Dashboard', icon: 'admin' as const }];
  const visibleTabs = userRole === 'admin' ? adminTabs : isLoggedIn ? [...publicTabs, ...privateTabs] : publicTabs;

  const dashboard = useMemo(() => {
    const openOpportunities = opportunities.filter((item) => item.status === 'Open').length;
    return [
      { label: 'Candidate Applications', value: candidates.length.toString() },
      { label: 'Partner Requests', value: partners.length.toString() },
      { label: 'Open Opportunities', value: openOpportunities.toString() },
      { label: 'Active Programs', value: programs.length.toString() }
    ];
  }, [candidates.length, partners.length]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  function navigateTo(tab: TabId) {
    if (tab === activeTab) return;

    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(tab);

    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setActiveTab(tab);
  }

  function goBack() {
    if (!canGoBack) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setActiveTab(history[nextIndex]);
  }

  function goForward() {
    if (!canGoForward) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setActiveTab(history[nextIndex]);
  }

  function continueAsVisitor() {
    setUserRole('visitor');
    setShowWelcome(false);
    writeToStorage('educareer:welcome-seen', true);
    navigateTo('portal');
  }

  function submitCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedRole = accountForm.role === 'partner' ? 'partner' : 'graduate';

    setUserRole(selectedRole);
    setShowWelcome(false);
    setLoginError('');
    writeToStorage('educareer:welcome-seen', true);

    if (selectedRole === 'partner') {
      setPartnerForm({
        ...blankPartner,
        organizationName: accountForm.organizationName,
        email: accountForm.email,
        phone: accountForm.phone
      });
    } else {
      setCandidateForm({
        ...blankCandidate,
        fullName: accountForm.fullName,
        email: accountForm.email,
        phone: accountForm.phone
      });
    }

    setConfirmationDialog({
      title: 'Account profile created',
      body: 'Your basic EduCareer account was created successfully. Please complete your profile in My EduCareer before accessing career matching, applications, or partner services.'
    });

    setAccountForm(blankAccountForm);
    navigateTo('portal');
  }

  function submitRoleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loginRole === 'admin') {
      const normalizedCode = loginCode.trim();
      const officialAdmin = adminAccounts.find(
        (account) => account.status === 'active' && account.accessCode.trim() === normalizedCode
      );

      const isDefaultSetupAdmin = normalizedCode === 'EduCareer@2026';

      if (!isDefaultSetupAdmin && !officialAdmin) {
        setLoginError('Invalid admin access code or blocked admin account.');
        return;
      }

      setUserRole('admin');
      setCurrentAdminRole(officialAdmin?.role ?? 'default_setup');
      setCurrentAdminLabel(officialAdmin?.fullName ?? 'Default Setup Admin');
      setShowWelcome(false);
      setLoginCode('');
      setLoginError('');
      writeToStorage('educareer:welcome-seen', true);
      navigateTo('dashboard');
      return;
    }

    const validCodes: Record<UserRole, string> = {
      visitor: '',
      graduate: 'Graduate@2026',
      partner: 'Partner@2026',
      admin: 'EduCareer@2026'
    };

    if (loginCode !== validCodes[loginRole]) {
      setLoginError('Invalid access code for the selected account type.');
      return;
    }

    setUserRole(loginRole);
    setShowWelcome(false);
    setLoginCode('');
    setLoginError('');
    writeToStorage('educareer:welcome-seen', true);
    navigateTo('portal');
  }

  function signOut() {
    setUserRole('visitor');
    setShowWelcome(true);
    setLoginCode('');
    setLoginError('');
    navigateTo('home');
  }

  function requireLogin(target: TabId) {
    if (isVisitor) {
      setShowWelcome(true);
      return;
    }

    navigateTo(target);
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const application: CandidateApplication = {
      id: makeId('candidate'),
      ...candidateForm,
      createdAt: new Date().toISOString()
    };
    setCandidates((current) => [application, ...current]);
    setCandidateForm(blankCandidate);
    setMessage('Graduate profile saved successfully. Career matching will use this profile information when the AI matching engine is connected.');
    navigateTo('home');
  }

  function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request: PartnerRequest = {
      id: makeId('partner'),
      ...partnerForm,
      createdAt: new Date().toISOString()
    };
    setPartners((current) => [request, ...current]);
    setPartnerForm(blankPartner);
    setMessage('');
    setConfirmationDialog({
      title: 'Partner request submitted',
      body: 'Your partner request was submitted successfully. The EduCareer team will review it in the Admin Dashboard and contact your organization after validation.'
    });
    navigateTo('home');
  }

  function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (adminCode === adminAccessCode) {
      setIsAdmin(true);
      setAdminCode('');
      setAdminError('');
      setMessage('Admin access granted.');
      return;
    }

    setAdminError('Invalid admin access code.');
  }

  function logoutAdmin() {
    setIsAdmin(false);
    setAdminCode('');
    setAdminError('');
    setUserRole('visitor');
    setCurrentAdminRole('default_setup');
    setCurrentAdminLabel('Default Setup Admin');
    setMessage('Admin session closed.');
    navigateTo('home');
  }

  function createAdminAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailExists = adminAccounts.some(
      (account) => account.email.toLowerCase() === adminAccountForm.email.toLowerCase()
    );

    const codeExists = adminAccounts.some(
      (account) => account.accessCode.trim() === adminAccountForm.accessCode.trim()
    ) || adminAccountForm.accessCode.trim() === 'EduCareer@2026';

    if (emailExists) {
      setConfirmationDialog({
        title: 'Admin account not created',
        body: 'An admin account with this email already exists.'
      });
      return;
    }

    if (codeExists) {
      setConfirmationDialog({
        title: 'Admin account not created',
        body: 'This access code is already in use. Please choose a unique temporary access code.'
      });
      return;
    }

    const nextAccount: AdminAccount = {
      ...adminAccountForm,
      id: `admin-${Date.now()}`,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setAdminAccounts([nextAccount, ...adminAccounts]);
    setAdminAccountForm(blankAdminAccount);

    setConfirmationDialog({
      title: 'Admin account created',
      body: `${getAdminRoleLabel(nextAccount.role)} was created for ${nextAccount.fullName}. In production, this should be replaced with Supabase Auth and secure invitation email.`
    });
  }

  function applyToOpportunity(opportunityId: string, opportunityTitle: string) {
    if (userRole === 'visitor') {
      setShowWelcome(true);
      return;
    }

    if (userRole !== 'graduate') {
      setConfirmationDialog({
        title: 'Graduate account required',
        body: 'Only graduate accounts can apply to opportunities. Partner accounts can publish or support opportunities after validation.'
      });
      return;
    }

    if (candidates.length === 0) {
      setConfirmationDialog({
        title: 'Complete your profile first',
        body: 'Before applying, please complete your graduate profile. Career matching and applications use your teaching area, qualification, interests, and career goals.'
      });
      navigateTo('register');
      return;
    }

    const nextAppliedOpportunityIds = Array.from(new Set([...appliedOpportunityIds, opportunityId]));
    setAppliedOpportunityIds(nextAppliedOpportunityIds);
    writeToStorage('educareer:applied-opportunity-ids', nextAppliedOpportunityIds);

    setConfirmationDialog({
      title: 'Application submitted',
      body: `Your application for "${opportunityTitle}" was recorded successfully. The button will now show Applied. In production, this application will be saved in the EduCareer database.`
    });
  }

  return (
    <div className="app-shell">
      {showWelcome && (
        <WelcomePrompt
          loginRole={loginRole}
          setLoginRole={setLoginRole}
          accountForm={accountForm}
          setAccountForm={setAccountForm}
          loginCode={loginCode}
          setLoginCode={setLoginCode}
          loginError={loginError}
          onContinueAsVisitor={continueAsVisitor}
          onSubmitCreateAccount={submitCreateAccount}
          onSubmitLogin={submitRoleLogin}
        />
      )}

      {confirmationDialog && (
        <ConfirmationDialog
          title={confirmationDialog.title}
          body={confirmationDialog.body}
          onClose={() => setConfirmationDialog(null)}
        />
      )}

      <header className="site-header">
        <div className="brand-block">
          <div className="brand-mark">EC</div>
          <div>
            <h1>EduCareer</h1>
            <p>Empowering Future Educators</p>
          </div>
        </div>

        <div className="nav-area">
          <nav className="nav-tabs" aria-label="Main navigation">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => navigateTo(tab.id)}
                type="button"
              >
                <Icon name={tab.icon} />
                {tab.label}
              </button>
            ))}

            <label className="language-picker">
              <Icon name="globe" />
              <select
                aria-label="Select page language"
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value)}
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
          </nav>

          <div className="account-strip">
            <span className={`role-badge role-${userRole}`}>
                {userRole === 'visitor'
                  ? 'Visitor mode'
                  : userRole === 'admin'
                    ? getAdminRoleLabel(currentAdminRole)
                    : `${userRole} account`}
              </span>
            {isLoggedIn && (
              <button className="secondary" type="button" onClick={signOut}>Sign out</button>
            )}
          </div>

          <div className="movement-controls" aria-label="Page movement controls">
            <button className="secondary" type="button" onClick={goBack} disabled={!canGoBack}>
              <Icon name="back" />
              Back
            </button>
            <button className="secondary" type="button" onClick={goForward} disabled={!canGoForward}>
              Forward
              <Icon name="forward" />
            </button>
          </div>
        </div>
      </header>

      <main>
        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')}>Dismiss</button>
          </div>
        )}

        {activeTab === 'home' && <HomeSection onNavigate={navigateTo} canShareActivity={canShareActivity} requireLogin={requireLogin} isLoggedIn={isLoggedIn} />}
        {activeTab === 'about' && <AboutSection onNavigate={navigateTo} />}
        {activeTab === 'programs' && <ProgramsSection />}
        {activeTab === 'opportunities' && (
          <OpportunitiesSection
            onNavigate={navigateTo}
            isVisitor={isVisitor}
            requireLogin={requireLogin}
            userRole={userRole}
            graduateProfile={candidates[0]}
            appliedOpportunityIds={appliedOpportunityIds}
            onApplyOpportunity={applyToOpportunity}
          />
        )}
        {activeTab === 'portal' && <PortalSection userRole={userRole} onNavigate={navigateTo} hasGraduateProfile={candidates.length > 0} hasPartnerProfile={partners.length > 0} />}
        {activeTab === 'register' && (
          <CandidateForm form={candidateForm} setForm={setCandidateForm} onSubmit={submitCandidate} />
        )}
        {activeTab === 'partners' && <PartnerForm form={partnerForm} setForm={setPartnerForm} onSubmit={submitPartner} />}
        {activeTab === 'contact' && <ContactSection onNavigate={navigateTo} />}
        {activeTab === 'dashboard' && (
          canAccessAdmin ? (
            <DashboardSection
                stats={dashboard}
                candidates={candidates}
                partners={partners}
                currentAdminRole={currentAdminRole}
                currentAdminLabel={currentAdminLabel}
                adminAccounts={adminAccounts}
                adminAccountForm={adminAccountForm}
                setAdminAccountForm={setAdminAccountForm}
                onCreateAdminAccount={createAdminAccount}
                onLogout={logoutAdmin}
              />
          ) : (
            <AdminLoginSection
              adminCode={adminCode}
              setAdminCode={setAdminCode}
              adminError={adminError}
              onSubmit={submitAdminLogin}
            />
          )
        )}
      </main>

      <footer className="footer">
        <div>
          <strong>EduCareer</strong>
          <p>Connecting academic preparation with meaningful teaching careers.</p>
        </div>
        <div>
          <p>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
          <p>Phone/WhatsApp: <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></p>
          <p>{contact.address}</p>
          {canAccessAdmin && (
            <button className="secondary" type="button" onClick={() => navigateTo('dashboard')}>
              <Icon name="admin" />
              Admin Dashboard
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}


function ConfirmationDialog({
  title,
  body,
  onClose
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <div className="confirmation-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirmation-card">
        <p className="eyebrow icon-eyebrow"><Icon name="impact" /> Confirmation</p>
        <h2>{title}</h2>
        <p>{body}</p>
        <button type="button" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}

function WelcomePrompt({
  loginRole,
  setLoginRole,
  accountForm,
  setAccountForm,
  loginCode,
  setLoginCode,
  loginError,
  onContinueAsVisitor,
  onSubmitCreateAccount,
  onSubmitLogin
}: {
  loginRole: UserRole;
  setLoginRole: (role: UserRole) => void;
  accountForm: typeof blankAccountForm;
  setAccountForm: (form: typeof blankAccountForm) => void;
  loginCode: string;
  setLoginCode: (code: string) => void;
  loginError: string;
  onContinueAsVisitor: () => void;
  onSubmitCreateAccount: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitLogin: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isPartnerSignup = accountForm.role === 'partner';

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-label="Welcome to EduCareer">
      <div className="welcome-card" tabIndex={0}>
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="home" /> Welcome to EduCareer</p>
          <h2>Choose how you want to access the platform.</h2>
          <p className="muted">
            Continue as a visitor to explore public information, create a Graduate or Partner profile, or log in to access your EduCareer workspace.
          </p>
        </div>

        <div className="welcome-actions">
          <div className="welcome-entry-options">
            <button type="button" onClick={onContinueAsVisitor}>Continue as Visitor</button>

            <form className="create-account-box" onSubmit={onSubmitCreateAccount}>
              <p className="eyebrow icon-eyebrow"><Icon name="teachers" /> New to EduCareer?</p>
              <h3>Create your profile</h3>
              <p className="muted">
                Fill in your basic information and choose whether you are creating a Graduate or Partner profile.
              </p>

              <label>
                Profile type
                <select
                  value={accountForm.role}
                  onChange={(event) => setAccountForm({ ...accountForm, role: event.target.value as UserRole })}
                >
                  <option value="graduate">Graduate Profile</option>
                  <option value="partner">Partner Profile</option>
                </select>
              </label>

              {isPartnerSignup ? (
                <label>
                  Organization name
                  <input
                    required
                    value={accountForm.organizationName}
                    onChange={(event) => setAccountForm({ ...accountForm, organizationName: event.target.value })}
                    placeholder="School or institution name"
                  />
                </label>
              ) : (
                <label>
                  Full name
                  <input
                    required
                    value={accountForm.fullName}
                    onChange={(event) => setAccountForm({ ...accountForm, fullName: event.target.value })}
                    placeholder="Your full name"
                  />
                </label>
              )}

              <label>
                Email
                <input
                  required
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
                  placeholder="email@example.com"
                />
              </label>

              <label>
                Phone
                <input
                  required
                  value={accountForm.phone}
                  onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value })}
                  placeholder="+258 ..."
                />
              </label>

              <button className="secondary" type="submit">
                Create Account
              </button>
            </form>
          </div>

          <form className="welcome-login" onSubmit={onSubmitLogin}>
            <label>
              Account type
              <select value={loginRole} onChange={(event) => setLoginRole(event.target.value as UserRole)}>
                <option value="graduate">Graduate</option>
                <option value="partner">Partner</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label>
              Access code
              <input
                type="password"
                value={loginCode}
                onChange={(event) => setLoginCode(event.target.value)}
                placeholder="Enter access code"
                required
              />
            </label>

            {loginError && <p className="auth-error">{loginError}</p>}

            <button className="secondary" type="submit">Log in to My EduCareer</button>
          </form>
        </div>

        <p className="muted small-note">
          Scroll inside this card if part of the form is hidden. Temporary demo codes: Graduate@2026, Partner@2026, EduCareer@2026. In production, this should be replaced with Supabase Auth.
        </p>
      </div>
    </div>
  );
}

function PortalSection({
  userRole,
  onNavigate,
  hasGraduateProfile,
  hasPartnerProfile
}: {
  userRole: UserRole;
  onNavigate: (tab: TabId) => void;
  hasGraduateProfile: boolean;
  hasPartnerProfile: boolean;
}) {
  const isGraduate = userRole === 'graduate';
  const isPartner = userRole === 'partner';
  const profileComplete = isGraduate ? hasGraduateProfile : isPartner ? hasPartnerProfile : true;

  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow"><Icon name="teachers" /> My EduCareer</p>
        <h2>Your EduCareer workspace.</h2>
        <p className="muted">
          This area is reserved for logged-in users. From here, graduates and partners can manage profiles, access opportunities, view programs, and prepare for AI-supported matching.
        </p>
      </div>

      <div className="portal-grid">
        <article className="content-card">
          <h3><Icon name="teachers" /> Profile Status</h3>
          <p>
            {profileComplete
              ? 'Your profile has been completed. You can now prepare for matching and applications.'
              : 'Your account was created, but your full profile is not complete yet.'}
          </p>
          {isGraduate && (
            <button type="button" onClick={() => onNavigate('register')}>
              {profileComplete ? 'Update Graduate Profile' : 'Complete Graduate Profile'}
            </button>
          )}
          {isPartner && (
            <button type="button" onClick={() => onNavigate('partners')}>
              {profileComplete ? 'Update Partner Profile' : 'Complete Partner Profile'}
            </button>
          )}
        </article>

        <article className="content-card">
          <h3><Icon name="mission" /> AI Career Matching</h3>
          {isGraduate ? (
            profileComplete ? (
              <p>
                Career matching will use OpenAI to read your graduate profile, available jobs, partner needs, and program opportunities to recommend the best fit.
              </p>
            ) : (
              <p>
                Career matching is locked until you complete your graduate profile. The system needs your teaching area, qualification, career goals, and availability before it can recommend opportunities.
              </p>
            )
          ) : (
            <p>
              Partner accounts will provide school needs, placement requests, and institutional opportunities that support the AI matching process.
            </p>
          )}
          <button className="secondary" type="button" disabled={!isGraduate || !profileComplete}>
            {isGraduate && profileComplete ? 'AI Matching Coming Soon' : 'Locked Until Profile Is Complete'}
          </button>
        </article>

        <article className="content-card">
          <h3><Icon name="opportunities" /> Opportunities</h3>
          <p>
            View open career, internship, mentorship, seminar, and teaching placement opportunities.
          </p>
          <button className="secondary" type="button" onClick={() => onNavigate('opportunities')}>
            View Opportunities
          </button>
        </article>

        <article className="content-card">
          <h3><Icon name="programs" /> Programs & Mentorship</h3>
          <p>
            Access EduLink, TeachReady, EduMentor, and Professional Growth Seminars.
          </p>
          <button className="secondary" type="button" onClick={() => onNavigate('programs')}>
            View Programs
          </button>
        </article>

        <article className="content-card">
          <h3><Icon name="partner" /> Partners List</h3>
          <p>
            View partner schools and institutions in read-only mode. Editing will remain restricted to administrators.
          </p>
        </article>

        <article className="content-card">
          <h3><Icon name="contact" /> Share EduCareer Moments</h3>
          <p>
            Share photos, testimonials, school placement highlights, workshops, and mentorship experiences after your account is fully validated.
          </p>
        </article>
      </div>
    </section>
  );
}

function HomeSection({
  onNavigate,
  canShareActivity,
  requireLogin,
  isLoggedIn
}: {
  onNavigate: (tab: TabId) => void;
  canShareActivity: boolean;
  requireLogin: (tab: TabId) => void;
  isLoggedIn: boolean;
}) {
  return (
    <section className="section-stack">
      <div className="hero-grid">
        <div className="hero-card">
          <p className="eyebrow hero-eyebrow">
            <Icon name="bridge" />
            Career bridge for educators
          </p>
          <h2>Helping teacher trainees move from academic study to sustainable employment.</h2>
          <p>
            EduCareer connects teacher training institutions, graduates, public schools, private schools, and local employers so that every trained educator can gain practical classroom experience and access meaningful career paths.
          </p>
          <div className="action-row">
            {isLoggedIn ? (
              <>
                <button type="button" onClick={() => onNavigate('portal')}>
                  <Icon name="teachers" />
                  Go to My EduCareer
                </button>
                <button className="secondary" type="button" onClick={() => onNavigate('opportunities')}>
                  <Icon name="opportunities" />
                  View Opportunities
                </button>
                <button className="secondary" type="button" onClick={() => onNavigate('contact')}>
                  <Icon name="contact" />
                  Contact EduCareer
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => requireLogin('register')}>
                  <Icon name="teachers" />
                  Register as Graduate
                </button>
                <button className="secondary" type="button" onClick={() => requireLogin('partners')}>
                  <Icon name="partner" />
                  Become a Partner
                </button>
                <button className="secondary" type="button" onClick={() => onNavigate('contact')}>
                  <Icon name="contact" />
                  Contact EduCareer
                </button>
              </>
            )}
          </div>
        </div>

        <div className="impact-card mission-vision-card">
          <p className="eyebrow icon-eyebrow">
            <Icon name="vision" />
            Mission & Vision
          </p>

          <div className="mini-statement">
            <strong>
              <Icon name="vision" />
              Vision
            </strong>
            <p>
              To cultivate a strong network of qualified, motivated, and empowered educators who drive the advancement of education in Sofala Province and beyond.
            </p>
          </div>

          <div className="mini-statement">
            <strong>
              <Icon name="mission" />
              Mission
            </strong>
            <p>
              To connect aspiring educators with employers, professional development, mentorship opportunities, and hands-on school engagement.
            </p>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card metric-card-with-icon" key={metric.label}>
            <span className="metric-icon"><Icon name={getMetricIcon(metric.label)} /></span>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
            <p>{metric.helper}</p>
          </article>
        ))}
      </div>

      <article className="content-card gallery-testimonial-frame">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow icon-eyebrow">
              <Icon name="impact" />
              Community in Action
            </p>
            <h3>Activity Gallery & Testimonials</h3>
            <p className="muted">
              This frame will showcase EduCareer workshops, school placements, mentoring sessions, seminars, and voices from graduates and partner schools.
            </p>
          </div>
          {canShareActivity && (
            <button className="secondary" type="button" onClick={() => onNavigate('portal')}>
              <Icon name="contact" />
              Share an Activity
            </button>
          )}
        </div>

        <div className="gallery-grid">
          <div className="gallery-tile">
            <span><Icon name="seminar" /></span>
            <strong>Professional Growth Seminars</strong>
            <p>Photos from classroom management, digital pedagogy, and job-readiness sessions.</p>
          </div>
          <div className="gallery-tile">
            <span><Icon name="placement" /></span>
            <strong>School Placements</strong>
            <p>Moments from TeachReady internships and assistant teacher placements.</p>
          </div>
          <div className="gallery-tile">
            <span><Icon name="mentor" /></span>
            <strong>Mentorship Sessions</strong>
            <p>Highlights from EduMentor meetings between experienced educators and new graduates.</p>
          </div>
        </div>

        <div className="testimonial-grid">
          <blockquote className="testimonial-card">
            “EduCareer can help young teachers enter classrooms with confidence, guidance, and a clearer professional path.”
            <cite>Graduate teacher testimonial</cite>
          </blockquote>
          <blockquote className="testimonial-card">
            “Partner schools benefit when motivated trainees support learning and reduce pressure in large classrooms.”
            <cite>Partner school testimonial</cite>
          </blockquote>
        </div>
      </article>
    </section>
  );
}

function AboutSection({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow">
          <Icon name="about" />
          About EduCareer
        </p>
        <h2>A professional bridge between teacher training and meaningful education employment.</h2>
        <p className="muted">
          EduCareer is a non-profit association based in Sofala Province, Mozambique. It supports postgraduate students and teacher trainees as they move from academic preparation into practical classroom experience, mentorship, and sustainable career opportunities.
        </p>
      </div>

      <div className="about-layout">
        <article className="content-card about-wide">
          <h3><Icon name="about" /> Organization Overview</h3>
          <p>
            EduCareer connects teacher training institutions, graduates, public schools, private schools, local employers, and education partners so that trained educators can access structured professional pathways.
          </p>
          <p>
            The association responds to a practical challenge in the education sector: many qualified or nearly qualified educators need field experience, while schools need motivated classroom support.
          </p>
        </article>

        <article className="content-card">
          <h3><Icon name="programs" /> Strategic Objectives</h3>
          <div className="objective-list">
            {objectives.map((objective, index) => (
              <div key={objective} className="objective-item">
                <span>{index + 1}</span>
                <p>{objective}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="content-card">
          <h3><Icon name="teachers" /> Target Beneficiaries</h3>
          <div className="pill-row">
            {beneficiaries.map((beneficiary) => <span key={beneficiary}>{beneficiary}</span>)}
          </div>
        </article>

        <article className="content-card">
          <h3><Icon name="admin" /> Governance</h3>
          <p>
            EduCareer is led by a Board of Directors made up of education professionals, representatives from training institutions, and community leaders.
          </p>
          <p>
            Day-to-day operations are coordinated by an Executive Director, Program Coordinator, Partnerships and Outreach Officer, and Administrative Assistant.
          </p>
        </article>

        <article className="content-card">
          <h3><Icon name="partner" /> Funding Sources</h3>
          <ul>
            <li>Education-focused NGO grants.</li>
            <li>Partnerships with universities and teacher training institutions.</li>
            <li>Local fundraising initiatives and community sponsorships.</li>
            <li>Government and donor-funded education programs.</li>
          </ul>
        </article>

        <article className="content-card about-wide">
          <h3><Icon name="impact" /> Expected Impact</h3>
          <ul>
            <li>Higher employment rates for graduate teachers in Sofala Province.</li>
            <li>Reduced student–teacher ratios in participating schools, especially where classroom pressure is high.</li>
            <li>Stronger collaboration between academic institutions and the education labour market.</li>
            <li>Improved teaching quality in public schools through fresh, motivated educators.</li>
            <li>Better classroom readiness and confidence among teacher trainees.</li>
          </ul>
          <div className="action-row">
            <button type="button" onClick={() => onNavigate('programs')}>
              <Icon name="programs" />
              Explore Programs
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate('register')}>
              <Icon name="teachers" />
              Register as Graduate
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate('partners')}>
              <Icon name="partner" />
              Become a Partner
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function ContactSection({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="contact" /> Contact EduCareer</p>
        <h2>Let us connect educators, schools, and partners.</h2>
        <p>
          Use these contact details for graduate registration, school partnerships, mentorship collaboration, seminars, and institutional support.
        </p>
        <div className="action-row">
          <button type="button" onClick={() => onNavigate('register')}>Graduate Registration</button>
          <button className="secondary" type="button" onClick={() => onNavigate('partners')}>Partner Request</button>
        </div>
      </div>

      <div className="section-stack">
        <article className="content-card">
          <h3>Contact Information</h3>
          <p>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
          <p>Phone: <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></p>
          <p>WhatsApp: <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}>{contact.whatsapp}</a></p>
          <p>Address: {contact.address}</p>
        </article>

        <article className="content-card">
          <h3>Who Should Contact Us?</h3>
          <ul>
            <li>Graduate teachers looking for career opportunities.</li>
            <li>Trainee teachers seeking practical classroom experience.</li>
            <li>Public or private schools needing motivated educators.</li>
            <li>Universities, training institutes, NGOs, and donor programs seeking education partnerships.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>Recommended Next Step</h3>
          <p>
            Graduates should submit the registration form. Schools and institutions should submit the partner request form. The EduCareer team can then review each request from the Admin Dashboard.
          </p>
        </article>
      </div>
    </section>
  );
}

function ProgramsSection() {
  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow"><Icon name="programs" /> Core Programs</p>
        <h2>Four programs that move educators from preparation to practice.</h2>
      </div>
      <div className="program-grid">
        {programs.map((program) => (
          <article className="program-card program-card-with-icon" key={program.id}>
            <span className="program-icon"><Icon name={getProgramIcon(program.id)} /></span>
            <p className="eyebrow">{program.tagline}</p>
            <h3>{program.name}</h3>
            <p>{program.description}</p>
            <ul>
              {program.activities.map((activity) => <li key={activity}>{activity}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function OpportunitiesSection({
  onNavigate,
  isVisitor,
  requireLogin,
  userRole,
  graduateProfile,
  appliedOpportunityIds,
  onApplyOpportunity
}: {
  onNavigate: (tab: TabId) => void;
  isVisitor: boolean;
  requireLogin: (tab: TabId) => void;
  userRole: UserRole;
  graduateProfile?: CandidateApplication;
  appliedOpportunityIds: string[];
  onApplyOpportunity: (opportunityId: string, opportunityTitle: string) => void;
}) {
  const programOrder = [
    'EduLink – Career Connection Platform',
    'TeachReady Internship Program',
    'EduMentor Network',
    'Professional Growth Seminars'
  ];

  const enrichedOpportunities = opportunities
    .map((opportunity) => ({
      opportunity,
      programName: getOpportunityProgramName(opportunity),
      isRecommended: isAiReadyRecommendedOpportunity(opportunity, graduateProfile)
    }));

  const groupedOpportunities = programOrder
    .map((programName) => ({
      programName,
      items: enrichedOpportunities
        .filter((item) => item.programName === programName)
        .sort((a, b) => {
          if (a.isRecommended !== b.isRecommended) {
            return a.isRecommended ? -1 : 1;
          }

          return new Date(a.opportunity.deadline).getTime() - new Date(b.opportunity.deadline).getTime();
        })
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="section-stack">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="opportunities" /> EduLink Opportunities</p>
          <h2>Current career, internship, mentorship, and seminar opportunities.</h2>
          <p className="muted">
            Opportunities are grouped by EduCareer program pillars and ordered by AI-ready profile fit and nearest deadline.
          </p>
        </div>

        {isVisitor ? (
          <button className="secondary" type="button" onClick={() => requireLogin('register')}>
            Register as Graduate First
          </button>
        ) : (
          <button type="button" onClick={() => onNavigate('portal')}>
            Go to My EduCareer
          </button>
        )}
      </div>

      <div className="opportunity-group-list">
        {groupedOpportunities.map((group) => (
          <section className="opportunity-group" key={group.programName}>
            <div className="opportunity-group-heading">
              <h3>{group.programName}</h3>
              <p>
                {group.items.filter((item) => item.isRecommended).length > 0
                  ? 'AI-ready recommended opportunities appear first, followed by the nearest deadlines.'
                  : 'Available opportunities are ordered by nearest deadline.'}
              </p>
            </div>

            <div className="opportunity-list">
              {group.items.map(({ opportunity, isRecommended }) => {
                const isOpen = opportunity.status === 'Open';
                const isApplied = appliedOpportunityIds.includes(opportunity.id);
                const canApply = userRole === 'graduate' && Boolean(graduateProfile) && isOpen;

                return (
                  <article className="opportunity-card" key={opportunity.id}>
                    <div>
                      <div className="opportunity-badges">
                        <span className={`status status-${opportunity.status.toLowerCase()}`}>{opportunity.status}</span>
                        {isRecommended && <span className="ai-match-badge">AI-ready match</span>}
                      </div>
                      <h3><Icon name={getOpportunityIcon(opportunity.type)} /> {opportunity.title}</h3>
                      <p>{opportunity.institution} · {opportunity.location}</p>
                    </div>

                    <div className="opportunity-meta">
                      <span>{opportunity.type}</span>
                      <span>Deadline: {new Date(opportunity.deadline).toLocaleDateString()}</span>
                    </div>

                    <ul>
                      {opportunity.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
                    </ul>

                    <div className="opportunity-actions">
                      {isVisitor && isOpen && (
                        <button className="secondary" type="button" onClick={() => requireLogin('register')}>
                          Register as Graduate First
                        </button>
                      )}

                      {!isVisitor && userRole === 'graduate' && isOpen && !graduateProfile && (
                        <button className="secondary" type="button" onClick={() => onNavigate('register')}>
                          Complete Profile to Apply
                        </button>
                      )}

                      {isApplied && (
                        <button className="secondary applied-button" type="button" disabled>
                          Applied
                        </button>
                      )}

                      {canApply && !isApplied && (
                        <button type="button" onClick={() => onApplyOpportunity(opportunity.id, opportunity.title)}>
                          Apply Now
                        </button>
                      )}

                      {!isVisitor && userRole !== 'graduate' && isOpen && (
                        <button className="secondary" type="button" disabled>
                          Graduate Application Only
                        </button>
                      )}

                      {!isOpen && (
                        <button className="secondary" type="button" disabled>
                          Not Open for Application
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}


function CandidateForm({
  form,
  setForm,
  onSubmit
}: {
  form: typeof blankCandidate;
  setForm: (form: typeof blankCandidate) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="teachers" /> Graduate Profile</p>
        <h2>Complete your graduate profile before career matching.</h2>
        <p>
          This profile stores your academic background, teaching area, qualification, and career goals. Later, the AI career matching engine will use this information to recommend the most suitable programs, opportunities, internships, mentorships, and jobs.
        </p>
      </div>
      <form className="form-card" onSubmit={onSubmit}>
        <label>
          Full name
          <input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            Email
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Phone
            <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Province
            <input required value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} />
          </label>
          <label>
            Training institution
            <input required value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Qualification
            <input required value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} />
          </label>
          <label>
            Teaching area
            <input required value={form.teachingArea} onChange={(event) => setForm({ ...form, teachingArea: event.target.value })} />
          </label>
        </div>
        <fieldset className="checkbox-group">
          <legend>Areas of interest / EduCareer programs</legend>
          <p className="muted">
            You can select one or more EduCareer programs. The future AI matching engine will use these interests together with your full profile.
          </p>
          <div className="checkbox-grid">
            {programs.map((program) => (
              <label className="checkbox-option" key={program.id}>
                <input
                  type="checkbox"
                  checked={form.preferredPrograms.includes(program.name)}
                  onChange={(event) => {
                    const nextPrograms = event.target.checked
                      ? Array.from(new Set([...form.preferredPrograms, program.name]))
                      : form.preferredPrograms.filter((name) => name !== program.name);

                    setForm({
                      ...form,
                      preferredPrograms: nextPrograms.length > 0 ? nextPrograms : [programs[0].name]
                    });
                  }}
                />
                <span>
                  <strong>{program.name}</strong>
                  <small>{program.tagline}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Motivation and career goals
          <textarea required rows={5} value={form.motivation} onChange={(event) => setForm({ ...form, motivation: event.target.value })} />
        </label>
        <button type="submit">Save Graduate Profile</button>
      </form>
    </section>
  );
}

function PartnerForm({
  form,
  setForm,
  onSubmit
}: {
  form: typeof blankPartner;
  setForm: (form: typeof blankPartner) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="partner" /> Partnership Request</p>
        <h2>Register a school, institution, or education partner.</h2>
        <p>
          Partner organizations can request assistant teachers, internship candidates, practice teachers, seminars, or mentorship collaboration.
        </p>
      </div>
      <form className="form-card" onSubmit={onSubmit}>
        <label>
          Organization name
          <input required value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            Contact person
            <input required value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
          </label>
          <label>
            Organization type
            <select value={form.organizationType} onChange={(event) => setForm({ ...form, organizationType: event.target.value })}>
              <option>Public School</option>
              <option>Private School</option>
              <option>Teacher Training Institute</option>
              <option>University</option>
              <option>NGO / Donor Program</option>
              <option>Education Authority</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Email
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Phone
            <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
        </div>
        <label>
          What support or collaboration is needed?
          <textarea required rows={5} value={form.supportNeeded} onChange={(event) => setForm({ ...form, supportNeeded: event.target.value })} />
        </label>
        <button type="submit">Submit Partner Request</button>
      </form>
    </section>
  );
}

function AdminLoginSection({
  adminCode,
  setAdminCode,
  adminError,
  onSubmit
}: {
  adminCode: string;
  setAdminCode: (value: string) => void;
  adminError: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="admin" /> Administrative Access</p>
        <h2>Restricted area for EduCareer staff.</h2>
        <p>
          The Admin Dashboard is not part of the public website navigation. It is reserved for authorized users who manage applications, partner requests, and program activity.
        </p>
        <p className="muted">
          This is a temporary MVP access screen. In the next phase, we should replace it with Supabase Auth.
        </p>
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        <label>
          Admin access code
          <input
            required
            type="password"
            value={adminCode}
            onChange={(event) => setAdminCode(event.target.value)}
            placeholder="Enter admin access code"
          />
        </label>

        {adminError && <p className="muted">{adminError}</p>}

        <button type="submit">Open Admin Dashboard</button>
      </form>
    </section>
  );
}

function DashboardSection({
  stats,
  candidates,
  partners,
  currentAdminRole,
  currentAdminLabel,
  adminAccounts,
  adminAccountForm,
  setAdminAccountForm,
  onCreateAdminAccount,
  onLogout: _onLogout
}: {
  stats: { label: string; value: string }[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
  currentAdminRole: AdminRole;
  currentAdminLabel: string;
  adminAccounts: AdminAccount[];
  adminAccountForm: AdminAccountForm;
  setAdminAccountForm: (form: AdminAccountForm) => void;
  onCreateAdminAccount: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
}) {
  const permissions = getAdminRolePermissions(currentAdminRole);
  const isDefaultSetupAdmin = currentAdminRole === 'default_setup';
  const isFullAdmin = isFullAdminRole(currentAdminRole);
  const canCreateAdmins = isDefaultSetupAdmin || isFullAdmin;

  type AdminModuleMode = 'manage' | 'read' | 'restricted';

  type AdminModuleDefinition = {
    label: string;
    ownerRoles: AdminRole[];
    description: string;
  };

  const moduleStatusLabel: Record<AdminModuleMode, string> = {
    manage: 'Can manage',
    read: 'Read only',
    restricted: 'Restricted'
  };

  function getModuleMode(ownerRoles: AdminRole[]): AdminModuleMode {
    if (isDefaultSetupAdmin) return 'restricted';
    if (isFullAdmin) return 'manage';
    return ownerRoles.includes(currentAdminRole) ? 'manage' : 'read';
  }

  const moduleDefinitions: AdminModuleDefinition[] = [
    {
      label: 'Graduate Requests',
      ownerRoles: ['hr'],
      description: 'Review graduate profiles, candidate applications, and compliance status.'
    },
    {
      label: 'Partner Requests',
      ownerRoles: ['partnerships'],
      description: 'Approve, reject, or request more information from partner institutions.'
    },
    {
      label: 'Account Blocking & Compliance',
      ownerRoles: ['hr'],
      description: 'Block, remove, or flag accounts that violate EduCareer policies.'
    },
    {
      label: 'Account Recovery Assistance',
      ownerRoles: ['support'],
      description: 'Assist users who lost account access or need profile recovery support.'
    },
    {
      label: 'Opportunities Management',
      ownerRoles: ['opportunities'],
      description: 'Issue, edit, publish, and close jobs, internships, seminars, and mentorship opportunities.'
    },
    {
      label: 'Programs & Activity Gallery',
      ownerRoles: ['programs'],
      description: 'Manage EduCareer programs, gallery posts, and activity updates.'
    },
    {
      label: 'Subscriptions Management',
      ownerRoles: ['subscriptions', 'finance'],
      description: 'Manage subscription plans, institutional subscriptions, and finance-related records.'
    },
    {
      label: 'Statistics & Reports',
      ownerRoles: ['statistics'],
      description: 'Manage analytics, reports, exports, and operational statistics.'
    }
  ];

  const modules = moduleDefinitions.map((module) => ({
    ...module,
    mode: getModuleMode(module.ownerRoles)
  }));

  return (
    <section className="section-stack admin-only-layout">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow icon-eyebrow"><Icon name="admin" /> Admin Dashboard</p>
          <h2>Administrative workspace for EduCareer operations.</h2>
          <p className="muted">
            Logged in as <strong>{currentAdminLabel}</strong> · {getAdminRoleLabel(currentAdminRole)}
          </p>
        </div>
      </div>

      <div className="admin-access-banner">
        <div>
          <h3>{getAdminRoleLabel(currentAdminRole)}</h3>
          <p>
            {isDefaultSetupAdmin
              ? 'This default setup admin is limited to read-only dashboard access and creation of official EduCareer admin accounts.'
              : isFullAdmin
                ? 'This admin has full operational control across all EduCareer modules and departments.'
                : 'This department admin can view the full administrative page, manage only the assigned department, and view other departments in read-only mode.'}
          </p>
        </div>
        <span>{isFullAdmin ? 'Full control' : isDefaultSetupAdmin ? 'Setup only' : 'Department access'}</span>
      </div>

      <div className="metric-grid">
        {stats.map((stat) => (
          <article className="metric-card compact" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      {canCreateAdmins && (
        <div className="dashboard-grid">
          <article className="content-card admin-account-form-card">
            <h3>Create EduCareer Admin Account</h3>
            <p className="muted">
              The default setup admin can create the first official admin accounts. CEO, IT, and Director admins can later create and manage additional admin accounts.
            </p>

            <form className="admin-account-form" onSubmit={onCreateAdminAccount}>
              <label>
                Full name
                <input
                  required
                  value={adminAccountForm.fullName}
                  onChange={(event) => setAdminAccountForm({ ...adminAccountForm, fullName: event.target.value })}
                  placeholder="Admin full name"
                />
              </label>

              <label>
                Email
                <input
                  required
                  type="email"
                  value={adminAccountForm.email}
                  onChange={(event) => setAdminAccountForm({ ...adminAccountForm, email: event.target.value })}
                  placeholder="admin@educareer.org"
                />
              </label>

              <label>
                Admin role
                <select
                  value={adminAccountForm.role}
                  onChange={(event) => setAdminAccountForm({ ...adminAccountForm, role: event.target.value as AdminRole })}
                >
                  {adminRoleOptions.map((option) => (
                    <option value={option.role} key={option.role}>
                      {option.label} — {option.scope}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Temporary access code
                <input
                  required
                  value={adminAccountForm.accessCode}
                  onChange={(event) => setAdminAccountForm({ ...adminAccountForm, accessCode: event.target.value })}
                  placeholder="Create a unique temporary code"
                />
              </label>

              <button type="submit">Create Admin Account</button>
            </form>
          </article>

          <article className="content-card dashboard-list">
            <h3>Official Admin Accounts</h3>
            {adminAccounts.length === 0 ? (
              <p className="muted">No official admin accounts created yet.</p>
            ) : (
              <div className="dashboard-items">
                {adminAccounts.map((account) => (
                  <div className="dashboard-item" key={account.id}>
                    <strong>{account.fullName}</strong>
                    <span>{getAdminRoleLabel(account.role)} · {account.status}</span>
                    <p>{account.email}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      )}

      <div className="dashboard-grid">
        <article className="content-card dashboard-list">
          <h3>Admin Permissions</h3>
          <ul className="admin-permission-list">
            {permissions.map((permission) => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </article>

        <article className="content-card dashboard-list">
          <h3>Management Modules</h3>
          <p className="muted">
            CEO, IT, and Director can manage all modules. Department admins can manage only their area and view the rest in read-only mode.
          </p>

          <div className="admin-module-grid">
            {modules.map((module) => (
              <div className={`admin-module ${module.mode}`} key={module.label}>
                <div>
                  <strong>{module.label}</strong>
                  <p>{module.description}</p>
                </div>
                <span>{moduleStatusLabel[module.mode]}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      {!isDefaultSetupAdmin && (
        <div className="dashboard-grid">
          <DashboardList
            title="Candidate Applications"
            empty="No candidate applications yet."
            items={candidates.map((candidate) => ({
              id: candidate.id,
              title: candidate.fullName,
              subtitle: `${candidate.teachingArea} · ${getCandidatePreferredPrograms(candidate).join(', ')}`,
              body: candidate.motivation,
              meta: `${candidate.email} · ${candidate.phone}`
            }))}
          />

          <DashboardList
            title="Partner Requests"
            empty="No partner requests yet."
            items={partners.map((partner) => ({
              id: partner.id,
              title: partner.organizationName,
              subtitle: `${partner.organizationType} · ${partner.contactPerson}`,
              body: partner.supportNeeded,
              meta: `${partner.email} · ${partner.phone}`
            }))}
          />
        </div>
      )}
    </section>
  );
}

function DashboardList({
  title,
  empty,
  items
}: {
  title: string;
  empty: string;
  items: { id: string; title: string; subtitle: string; body: string; meta: string }[];
}) {
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

function getCandidatePreferredPrograms(candidate: CandidateApplication): string[] {
  const legacyProgram = (candidate as CandidateApplication & { preferredProgram?: string }).preferredProgram;

  if (Array.isArray(candidate.preferredPrograms) && candidate.preferredPrograms.length > 0) {
    return candidate.preferredPrograms;
  }

  if (legacyProgram) {
    return [legacyProgram];
  }

  return ['No program selected'];
}

function getOpportunityProgramName(opportunity: typeof opportunities[number]): string {
  if (opportunity.type === 'Internship' || opportunity.type === 'Practice Teaching') {
    return 'TeachReady Internship Program';
  }

  if (opportunity.type === 'Mentorship') {
    return 'EduMentor Network';
  }

  if (opportunity.type === 'Seminar') {
    return 'Professional Growth Seminars';
  }

  return 'EduLink – Career Connection Platform';
}

function isAiReadyRecommendedOpportunity(
  opportunity: typeof opportunities[number],
  graduateProfile?: CandidateApplication
): boolean {
  if (!graduateProfile) return false;

  const legacyProgram = (graduateProfile as CandidateApplication & { preferredProgram?: string }).preferredProgram;
  const selectedPrograms = graduateProfile.preferredPrograms ?? (legacyProgram ? [legacyProgram] : []);
  const programName = getOpportunityProgramName(opportunity);

  if (selectedPrograms.includes(programName)) return true;

  const profileText = [
    graduateProfile.qualification,
    graduateProfile.teachingArea,
    graduateProfile.motivation
  ].join(' ').toLowerCase();

  const opportunityText = [
    opportunity.title,
    opportunity.type,
    opportunity.requirements.join(' ')
  ].join(' ').toLowerCase();

  const profileWords = profileText
    .split(/\W+/)
    .filter((word) => word.length > 4);

  return profileWords.some((word) => opportunityText.includes(word));
}

function getMetricIcon(label: string): IconName {
  if (label.toLowerCase().includes('teacher')) return 'teachers';
  if (label.toLowerCase().includes('ratio')) return 'ratio';
  if (label.toLowerCase().includes('program')) return 'programs';
  return 'region';
}

function getProgramIcon(id: string): IconName {
  if (id === 'teachready') return 'placement';
  if (id === 'edumentor') return 'mentor';
  if (id === 'seminars') return 'seminar';
  return 'bridge';
}

function getOpportunityIcon(type: string): IconName {
  if (type === 'Internship' || type === 'Assistant Teacher' || type === 'Practice Teaching') return 'placement';
  if (type === 'Mentorship') return 'mentor';
  if (type === 'Seminar') return 'seminar';
  return 'opportunities';
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'home' && <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />}
      {name === 'about' && <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10h.01" />}
      {name === 'programs' && <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm4 2h8m-8 4h7" />}
      {name === 'opportunities' && <path d="M9 6V5a3 3 0 0 1 6 0v1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h4Zm0 0h6m-9 5h12" />}
      {name === 'bridge' && <path d="M4 17h16M6 17c0-5 2.5-9 6-9s6 4 6 9M8 13h8M12 8v9" />}
      {name === 'vision' && <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />}
      {name === 'mission' && <path d="M12 21a9 9 0 1 1 9-9h-4a5 5 0 1 0-5 5v4Zm6-6 3-3-3-3m3 3h-9" />}
      {name === 'seminar' && <path d="M4 6h16v10H4V6Zm3 13h10M9 16v3m6-3v3M8 10h8" />}
      {name === 'placement' && <path d="M4 20V9l8-5 8 5v11H4Zm4 0v-6h8v6M9 10h.01M15 10h.01" />}
      {name === 'mentor' && <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a5 5 0 0 1 10 0m-2 0a5 5 0 0 1 10 0" />}
      {name === 'teachers' && <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a3 3 0 1 0 0-6m-13 14a5 5 0 0 1 10 0m1-1a5 5 0 0 1 7 1" />}
      {name === 'ratio' && <path d="M4 7h9m-9 5h16M11 17h9M17 4l3 3-3 3M7 14l-3 3 3 3" />}
      {name === 'region' && <path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />}
      {name === 'partner' && <path d="M8 12 4 8a3 3 0 0 1 4-4l4 4 4-4a3 3 0 0 1 4 4l-4 4m-8 0 4 4 4-4m-8 0 4-4m4 4-4-4" />}
      {name === 'contact' && <path d="M4 5h16v14H4V5Zm0 2 8 6 8-6" />}
      {name === 'admin' && <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4 5a4 4 0 0 1 8 0" />}
      {name === 'globe' && <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.2 2.3 3.2 5.3 3.2 9S14.2 18.7 12 21m0-18C9.8 5.3 8.8 8.3 8.8 12s1 6.7 3.2 9M3.8 9h16.4M3.8 15h16.4" />}
      {name === 'back' && <path d="M15 6 9 12l6 6" />}
      {name === 'forward' && <path d="m9 6 6 6-6 6" />}
      {name === 'impact' && <path d="M12 20V10m0 10-4-4m4 4 4-4M5 10a7 7 0 0 1 14 0M7 10a5 5 0 0 1 10 0" />}
    </svg>
  );
}
