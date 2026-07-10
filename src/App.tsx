import { FormEvent, useEffect, useMemo, useState } from 'react';
import { beneficiaries, contact, metrics, objectives, opportunities, programs } from './data';
import type { CandidateApplication, PartnerRequest, TabId } from './types';
import { makeId, readFromStorage, writeToStorage } from './utils/storage';
import { supabase } from './lib/supabase';

const candidateKey = 'educareer:candidates';
const partnerKey = 'educareer:partners';

const tabs: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About Us' },
  { id: 'programs', label: 'Programs' },
  { id: 'opportunities', label: 'Opportunities' }
];

const blankCandidate = {
  fullName: '',
  email: '',
  phone: '',
  province: 'Sofala',
  institution: '',
  qualification: '',
  teachingArea: '',
  preferredProgram: 'EduLink – Career Connection Platform',
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

type AdminProfile = {
  id: string;
  email: string;
  username: string;
  role: string;
  must_change_credentials: boolean;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [candidateForm, setCandidateForm] = useState(blankCandidate);
  const [partnerForm, setPartnerForm] = useState(blankPartner);
  const [candidates, setCandidates] = useState<CandidateApplication[]>(() =>
    readFromStorage<CandidateApplication[]>(candidateKey, [])
  );
  const [partners, setPartners] = useState<PartnerRequest[]>(() => readFromStorage<PartnerRequest[]>(partnerKey, []));
  const [message, setMessage] = useState('');
  const [adminLogin, setAdminLogin] = useState({ username: 'default.admin', password: '' });
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [credentialForm, setCredentialForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [mustChangeAdminCredentials, setMustChangeAdminCredentials] = useState(false);

  useEffect(() => writeToStorage(candidateKey, candidates), [candidates]);
  useEffect(() => writeToStorage(partnerKey, partners), [partners]);

  const dashboard = useMemo(() => {
    const openOpportunities = opportunities.filter((item) => item.status === 'Open').length;
    return [
      { label: 'Candidate Applications', value: candidates.length.toString() },
      { label: 'Partner Requests', value: partners.length.toString() },
      { label: 'Open Opportunities', value: openOpportunities.toString() },
      { label: 'Active Programs', value: programs.length.toString() }
    ];
  }, [candidates.length, partners.length]);

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const application: CandidateApplication = {
      id: makeId('candidate'),
      ...candidateForm,
      createdAt: new Date().toISOString()
    };
    setCandidates((current) => [application, ...current]);
    setCandidateForm(blankCandidate);
    setMessage('Candidate application submitted successfully. The EduCareer team will review it and contact you.');
    setActiveTab('home');
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
    setMessage('Partner request submitted successfully. The EduCareer team will review it and contact your organization.');
    setActiveTab('home');
  }

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError('');

    const username = adminLogin.username.trim();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, username, role, must_change_credentials')
      .eq('username', username)
      .single();

    if (profileError || !profile) {
      setAdminError('Nome de utilizador ou senha inválidos.');
      return;
    }

    if (profile.role !== 'admin') {
      setAdminError('Esta conta não tem permissão administrativa.');
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: adminLogin.password
    });

    if (loginError) {
      setAdminError('Nome de utilizador ou senha inválidos.');
      return;
    }

    const admin = profile as AdminProfile;
    setAdminProfile(admin);
    setIsAdmin(true);
    setAdminLogin({ username: admin.username, password: '' });
    setMustChangeAdminCredentials(Boolean(admin.must_change_credentials));
    setCredentialForm({ username: admin.username, password: '', confirmPassword: '' });

    if (admin.must_change_credentials) {
      setMessage('Primeiro acesso detectado. Altere o nome de utilizador e a senha temporária.');
    } else {
      setMessage('Admin access granted.');
    }

    setActiveTab('dashboard');
  }

  async function submitAdminCredentialChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError('');

    if (!adminProfile) {
      setAdminError('Sessão administrativa inválida. Faça login novamente.');
      return;
    }

    const newUsername = credentialForm.username.trim();

    if (newUsername.length < 4) {
      setAdminError('O novo nome de utilizador deve ter pelo menos 4 caracteres.');
      return;
    }

    if (credentialForm.password.length < 8) {
      setAdminError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (credentialForm.password !== credentialForm.confirmPassword) {
      setAdminError('As senhas não coincidem.');
      return;
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password: credentialForm.password
    });

    if (passwordError) {
      setAdminError(passwordError.message);
      return;
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        username: newUsername,
        must_change_credentials: false
      })
      .eq('id', adminProfile.id);

    if (profileUpdateError) {
      setAdminError(profileUpdateError.message);
      return;
    }

    setAdminProfile({
      ...adminProfile,
      username: newUsername,
      must_change_credentials: false
    });
    setMustChangeAdminCredentials(false);
    setCredentialForm({ username: newUsername, password: '', confirmPassword: '' });
    setMessage('Credenciais administrativas atualizadas com sucesso.');
  }

  async function logoutAdmin() {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAdminProfile(null);
    setAdminLogin({ username: 'default.admin', password: '' });
    setCredentialForm({ username: '', password: '', confirmPassword: '' });
    setMustChangeAdminCredentials(false);
    setAdminError('');
    setMessage('Admin session closed.');
    setActiveTab('home');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <div className="brand-mark">EC</div>
          <div>
            <h1>EduCareer</h1>
            <p>Empowering Future Educators</p>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')}>Dismiss</button>
          </div>
        )}

        {activeTab === 'home' && <HomeSection onNavigate={setActiveTab} />}
        {activeTab === 'about' && <AboutSection onNavigate={setActiveTab} />}
        {activeTab === 'programs' && <ProgramsSection />}
        {activeTab === 'opportunities' && <OpportunitiesSection onNavigate={setActiveTab} />}
        {activeTab === 'register' && (
          <CandidateForm form={candidateForm} setForm={setCandidateForm} onSubmit={submitCandidate} />
        )}
        {activeTab === 'partners' && <PartnerForm form={partnerForm} setForm={setPartnerForm} onSubmit={submitPartner} />}
        {activeTab === 'contact' && <ContactSection onNavigate={setActiveTab} />}
          {activeTab === 'dashboard' && (
            isAdmin ? (
              mustChangeAdminCredentials ? (
                <AdminCredentialChangeSection
                  form={credentialForm}
                  setForm={setCredentialForm}
                  adminError={adminError}
                  onSubmit={submitAdminCredentialChange}
                  onLogout={logoutAdmin}
                />
              ) : (
                <DashboardSection stats={dashboard} candidates={candidates} partners={partners} onLogout={logoutAdmin} />
              )
            ) : (
              <AdminLoginSection
                form={adminLogin}
                setForm={setAdminLogin}
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
          <button className="secondary" type="button" onClick={() => setActiveTab('dashboard')}>
            {isAdmin ? 'Admin Dashboard' : 'Admin Access'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function HomeSection({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return (
    <section className="section-stack">
      <div className="hero-grid">
        <div className="hero-card">
          <p className="eyebrow">Career bridge for educators</p>
          <h2>Helping teacher trainees move from academic study to sustainable employment.</h2>
          <p>
            EduCareer connects teacher training institutions, graduates, public schools, private schools, and local employers so that every trained educator can gain practical classroom experience and access meaningful career paths.
          </p>
          <div className="action-row">
            <button type="button" onClick={() => onNavigate('register')}>Register as Graduate</button>
            <button className="secondary" type="button" onClick={() => onNavigate('partners')}>Become a Partner</button>
            <button className="secondary" type="button" onClick={() => onNavigate('contact')}>Contact EduCareer</button>
          </div>
        </div>

        <div className="impact-card mission-vision-card">
          <p className="eyebrow">Mission & Vision</p>
          <div className="mini-statement">
            <strong>Vision</strong>
            <p>
              To cultivate a strong network of qualified, motivated, and empowered educators who drive the advancement of education in Sofala Province and beyond.
            </p>
          </div>

          <div className="mini-statement">
            <strong>Mission</strong>
            <p>
              To connect aspiring educators with employers, professional development, mentorship opportunities, and hands-on school engagement.
            </p>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
            <p>{metric.helper}</p>
          </article>
        ))}
      </div>

      <article className="content-card gallery-testimonial-frame">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">Community in Action</p>
            <h3>Activity Gallery & Testimonials</h3>
            <p className="muted">
              This frame will showcase EduCareer workshops, school placements, mentoring sessions, seminars, and voices from graduates and partner schools.
            </p>
          </div>
          <button className="secondary" type="button" onClick={() => onNavigate('contact')}>Share an Activity</button>
        </div>

        <div className="gallery-grid">
          <div className="gallery-tile">
            <span>📚</span>
            <strong>Professional Growth Seminars</strong>
            <p>Photos from classroom management, digital pedagogy, and job-readiness sessions.</p>
          </div>
          <div className="gallery-tile">
            <span>🏫</span>
            <strong>School Placements</strong>
            <p>Moments from TeachReady internships and assistant teacher placements.</p>
          </div>
          <div className="gallery-tile">
            <span>🤝</span>
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
        <p className="eyebrow">About EduCareer</p>
        <h2>A professional bridge between teacher training and meaningful education employment.</h2>
        <p className="muted">
          EduCareer is a non-profit association based in Sofala Province, Mozambique. It supports postgraduate students and teacher trainees as they move from academic preparation into practical classroom experience, mentorship, and sustainable career opportunities.
        </p>
      </div>

      <div className="about-layout">
        <article className="content-card about-wide">
          <h3>Organization Overview</h3>
          <p>
            EduCareer connects teacher training institutions, graduates, public schools, private schools, local employers, and education partners so that trained educators can access structured professional pathways.
          </p>
          <p>
            The association responds to a practical challenge in the education sector: many qualified or nearly qualified educators need field experience, while schools need motivated classroom support.
          </p>
        </article>

        <article className="content-card">
          <h3>Strategic Objectives</h3>
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
          <h3>Target Beneficiaries</h3>
          <div className="pill-row">
            {beneficiaries.map((beneficiary) => <span key={beneficiary}>{beneficiary}</span>)}
          </div>
        </article>

        <article className="content-card">
          <h3>Governance</h3>
          <p>
            EduCareer is led by a Board of Directors made up of education professionals, representatives from training institutions, and community leaders.
          </p>
          <p>
            Day-to-day operations are coordinated by an Executive Director, Program Coordinator, Partnerships and Outreach Officer, and Administrative Assistant.
          </p>
        </article>

        <article className="content-card">
          <h3>Funding Sources</h3>
          <ul>
            <li>Education-focused NGO grants.</li>
            <li>Partnerships with universities and teacher training institutions.</li>
            <li>Local fundraising initiatives and community sponsorships.</li>
            <li>Government and donor-funded education programs.</li>
          </ul>
        </article>

        <article className="content-card about-wide">
          <h3>Expected Impact</h3>
          <ul>
            <li>Higher employment rates for graduate teachers in Sofala Province.</li>
            <li>Reduced student–teacher ratios in participating schools, especially where classroom pressure is high.</li>
            <li>Stronger collaboration between academic institutions and the education labour market.</li>
            <li>Improved teaching quality in public schools through fresh, motivated educators.</li>
            <li>Better classroom readiness and confidence among teacher trainees.</li>
          </ul>
          <div className="action-row">
            <button type="button" onClick={() => onNavigate('programs')}>Explore Programs</button>
            <button className="secondary" type="button" onClick={() => onNavigate('register')}>Register as Graduate</button>
            <button className="secondary" type="button" onClick={() => onNavigate('partners')}>Become a Partner</button>
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
        <p className="eyebrow">Contact EduCareer</p>
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
        <p className="eyebrow">Core Programs</p>
        <h2>Four programs that move educators from preparation to practice.</h2>
      </div>
      <div className="program-grid">
        {programs.map((program) => (
          <article className="program-card" key={program.id}>
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

function OpportunitiesSection({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return (
    <section className="section-stack">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">EduLink Opportunities</p>
          <h2>Current career, internship, mentorship, and seminar opportunities.</h2>
        </div>
        <button type="button" onClick={() => onNavigate('register')}>Apply as Candidate</button>
      </div>
      <div className="opportunity-list">
        {opportunities.map((opportunity) => (
          <article className="opportunity-card" key={opportunity.id}>
            <div>
              <span className={`status status-${opportunity.status.toLowerCase()}`}>{opportunity.status}</span>
              <h3>{opportunity.title}</h3>
              <p>{opportunity.institution} · {opportunity.location}</p>
            </div>
            <div className="opportunity-meta">
              <span>{opportunity.type}</span>
              <span>Deadline: {new Date(opportunity.deadline).toLocaleDateString()}</span>
            </div>
            <ul>
              {opportunity.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
            </ul>
          </article>
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
        <p className="eyebrow">Graduate Registration</p>
        <h2>Create a candidate profile for career matching.</h2>
        <p>
          This form collects essential information from postgraduate students and teacher trainees so EduCareer can match them with placements, internships, mentorship, and seminars.
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
        <label>
          Preferred program
          <select value={form.preferredProgram} onChange={(event) => setForm({ ...form, preferredProgram: event.target.value })}>
            {programs.map((program) => <option key={program.id}>{program.name}</option>)}
          </select>
        </label>
        <label>
          Motivation and career goals
          <textarea required rows={5} value={form.motivation} onChange={(event) => setForm({ ...form, motivation: event.target.value })} />
        </label>
        <button type="submit">Submit Application</button>
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
        <p className="eyebrow">Partnership Request</p>
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
  form,
  setForm,
  adminError,
  onSubmit
}: {
  form: { username: string; password: string };
  setForm: (value: { username: string; password: string }) => void;
  adminError: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow">Administrative Access</p>
        <h2>Área restrita para a equipa EduCareer.</h2>
        <p>
          O painel administrativo é reservado para utilizadores autorizados que gerem candidaturas, parceiros e programas.
        </p>
        <p className="muted">
          Use a conta default apenas no primeiro acesso. Depois será obrigatório alterar o nome de utilizador e a senha.
        </p>
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        <label>
          Nome de utilizador
          <input
            required
            type="text"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="default.admin"
          />
        </label>

        <label>
          Senha
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Digite a sua senha"
          />
        </label>

        {adminError && <p className="muted">{adminError}</p>}

        <button type="submit">Entrar</button>
      </form>
    </section>
  );
}

function AdminCredentialChangeSection({
  form,
  setForm,
  adminError,
  onSubmit,
  onLogout
}: {
  form: { username: string; password: string; confirmPassword: string };
  setForm: (value: { username: string; password: string; confirmPassword: string }) => void;
  adminError: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
}) {
  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow">Primeiro acesso</p>
        <h2>Altere as credenciais temporárias.</h2>
        <p>
          Por segurança, a conta default.admin só serve para criar o primeiro administrador.
          Antes de acessar ao painel, defina um novo nome de utilizador e uma nova senha.
        </p>
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        <label>
          Novo nome de utilizador
          <input
            required
            type="text"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="ex: admin.isac"
          />
        </label>

        <label>
          Nova senha
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Mínimo 8 caracteres"
          />
        </label>

        <label>
          Confirmar nova senha
          <input
            required
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            placeholder="Repita a nova senha"
          />
        </label>

        {adminError && <p className="muted">{adminError}</p>}

        <button type="submit">Atualizar credenciais</button>
        <button className="secondary" type="button" onClick={onLogout}>Sair</button>
      </form>
    </section>
  );
}

function DashboardSection({
  stats,
  candidates,
  partners,
  onLogout
}: {
  stats: { label: string; value: string }[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
  onLogout: () => void;
}) {
  return (
    <section className="section-stack">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h2>Operational view for applications, partnerships, and program activity.</h2>
        </div>
        <button className="secondary" type="button" onClick={onLogout}>Logout</button>
      </div>
      <div className="metric-grid">
        {stats.map((stat) => (
          <article className="metric-card compact" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <DashboardList
          title="Candidate Applications"
          empty="No candidate applications yet."
          items={candidates.map((candidate) => ({
            id: candidate.id,
            title: candidate.fullName,
            subtitle: `${candidate.teachingArea} · ${candidate.preferredProgram}`,
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
