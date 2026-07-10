import type { FormEvent } from 'react';
import { Icon } from '../components/Icon';
import type { CandidateFormState } from '../constants';
import { programs } from '../data';
import { localizeProgram, useI18n } from '../i18n';

type CandidateFormPageProps = {
  form: CandidateFormState;
  setForm: (form: CandidateFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CandidateFormPage({ form, setForm, onSubmit }: CandidateFormPageProps) {
  const { language, t } = useI18n();

  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="teachers" /> {t('candidate.eyebrow')}</p>
        <h2>{t('candidate.title')}</h2>
        <p>{t('candidate.body')}</p>
      </div>
      <form className="form-card" onSubmit={onSubmit}>
        <div className="credential-panel">
          <div className="credential-panel-heading">
              <span><Icon name="admin" /></span>
              <div>
              <h3>{t('form.credentialsTitle')}</h3>
              <p>{t('form.credentialsGraduate')}</p>
              </div>
            </div>
          <div className="form-grid">
            <label>
              {t('form.username')}
              <input
                required
                autoComplete="username"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </label>
            <label>
              {t('form.password')}
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="form-section-label">{t('candidate.profile')}</div>
        <label>
          {t('form.fullName')}
          <input required autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            {t('form.email')}
            <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            {t('form.phone')}
            <input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {t('candidate.province')}
            <input required value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} />
          </label>
          <label>
            {t('candidate.institution')}
            <input required value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {t('candidate.qualification')}
            <input required value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} />
          </label>
          <label>
            {t('candidate.teachingArea')}
            <input required value={form.teachingArea} onChange={(event) => setForm({ ...form, teachingArea: event.target.value })} />
          </label>
        </div>
        <label>
          {t('candidate.preferredProgram')}
          <select value={form.preferredProgram} onChange={(event) => setForm({ ...form, preferredProgram: event.target.value })}>
            {programs.map((program) => (
              <option key={program.id} value={program.name}>
                {localizeProgram(language, program).name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('candidate.motivation')}
          <textarea required rows={5} value={form.motivation} onChange={(event) => setForm({ ...form, motivation: event.target.value })} />
        </label>
        <button type="submit">
          <Icon name="teachers" />
          {t('candidate.submit')}
        </button>
      </form>
    </section>
  );
}
