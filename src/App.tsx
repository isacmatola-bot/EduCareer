import { FormEvent, useEffect, useMemo, useState } from 'react';
import { beneficiaries, contact, metrics, objectives, opportunities, programs } from './data';
import type { CandidateApplication, PartnerRequest, TabId } from './types';
import { makeId, readFromStorage, writeToStorage } from './utils/storage';

const candidateKey = 'educareer:candidates';
const partnerKey = 'educareer:partners';

const tabs: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'programs', label: 'Programs' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'register', label: 'Graduate Registration' },
  { id: 'partners', label: 'Partner Schools' },
  { id: 'dashboard', label: 'Admin Dashboard' }
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [candidateForm, setCandidateForm] = useState(blankCandidate);
  const [partnerForm, setPartnerForm] = useState(blankPartner);
  const [candidates, setCandidates] = useState<CandidateApplication[]>(() =>
    readFromStorage<CandidateApplication[]>(candidateKey, [])
  );
  const [partners, setPartners] = useState<PartnerRequest[]>(() => readFromStorage<PartnerRequest[]>(partnerKey, []));
  const [message, setMessage] = useState('');

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
    setMessage('Candidate application submitted successfully. The EduCareer team can now review it in the dashboard.');
    setActiveTab('dashboard');
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
    setMessage('Partner request submitted successfully. It is now available in the dashboard.');
    setActiveTab('dashboard');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <div className="brand-mark">EC</div>
          <div>
            <p className="eyebrow">Non-profit association · Sofala Province, Mozambique</p>
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
        {activeTab === 'programs' && <ProgramsSection />}
        {activeTab === 'opportunities' && <OpportunitiesSection onNavigate={setActiveTab} />}
        {activeTab === 'register' && (
          <CandidateForm form={candidateForm} setForm={setCandidateForm} onSubmit={submitCandidate} />
        )}
        {activeTab === 'partners' && <PartnerForm form={partnerForm} setForm={setPartnerForm} onSubmit={submitPartner} />}
        {activeTab === 'dashboard' && <DashboardSection stats={dashboard} candidates={candidates} partners={partners} />}
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
            <button className="secondary" type="button" onClick={() => onNavigate('partners')}>Become a Partner School</button>
          </div>
        </div>
        <div className="impact-card">
          <h3>Expected Impact</h3>
          <ul>
            <li>Higher employment rates for graduate teachers in Sofala Province.</li>
            <li>Reduced student–teacher ratios in participating schools.</li>
            <li>Stronger collaboration between institutions and the education labour market.</li>
            <li>Improved teaching quality through fresh, motivated educators.</li>
            <li>Better classroom readiness and confidence among teacher trainees.</li>
          </ul>
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

      <div className="two-column">
        <article className="content-card">
          <h3>Vision</h3>
          <p>
            To cultivate a strong network of qualified, motivated, and empowered educators who drive the advancement of education in Sofala Province and beyond.
          </p>
        </article>
        <article className="content-card">
          <h3>Mission</h3>
          <p>
            EduCareer connects aspiring educators with employers, professional development, mentorship opportunities, and hands-on school engagement.
          </p>
        </article>
      </div>

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
        <button type="submit">Submit Candidate Application</button>
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

function DashboardSection({
  stats,
  candidates,
  partners
}: {
  stats: { label: string; value: string }[];
  candidates: CandidateApplication[];
  partners: PartnerRequest[];
}) {
  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow">Admin Dashboard</p>
        <h2>Operational view for applications, partnerships, and program activity.</h2>
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
