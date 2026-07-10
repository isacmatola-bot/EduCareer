import type { FormEvent } from 'react';
import { Icon } from '../components/Icon';
import type { PartnerFormState } from '../constants';
import { useI18n } from '../i18n';

type PartnerFormPageProps = {
  form: PartnerFormState;
  setForm: (form: PartnerFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PartnerFormPage({ form, setForm, onSubmit }: PartnerFormPageProps) {
  const { t } = useI18n();
  const organizationTypes = [
    { value: 'Public School', label: t('partner.type.publicSchool') },
    { value: 'Private School', label: t('partner.type.privateSchool') },
    { value: 'Teacher Training Institute', label: t('partner.type.trainingInstitute') },
    { value: 'University', label: t('partner.type.university') },
    { value: 'NGO / Donor Program', label: t('partner.type.ngo') },
    { value: 'Education Authority', label: t('partner.type.authority') }
  ];

  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="partner" /> {t('partner.eyebrow')}</p>
        <h2>{t('partner.title')}</h2>
        <p>{t('partner.body')}</p>
      </div>
      <form className="form-card" onSubmit={onSubmit}>
        <div className="credential-panel partner-credential-panel">
          <div className="credential-panel-heading">
              <span><Icon name="partner" /></span>
              <div>
              <h3>{t('form.credentialsTitle')}</h3>
              <p>{t('form.credentialsPartner')}</p>
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

        <div className="form-section-label">{t('partner.profile')}</div>
        <label>
          {t('partner.organizationName')}
          <input required value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            {t('partner.contactPerson')}
            <input required value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
          </label>
          <label>
            {t('partner.organizationType')}
            <select value={form.organizationType} onChange={(event) => setForm({ ...form, organizationType: event.target.value })}>
              {organizationTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>
        </div>
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
        <label>
          {t('partner.supportNeeded')}
          <textarea required rows={5} value={form.supportNeeded} onChange={(event) => setForm({ ...form, supportNeeded: event.target.value })} />
        </label>
        <button type="submit">
          <Icon name="partner" />
          {t('partner.submit')}
        </button>
      </form>
    </section>
  );
}
