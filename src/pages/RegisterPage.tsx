import type { FormEvent } from 'react';
import type { RegistrationMode } from '../auth';
import { Icon } from '../components/Icon';
import type { CandidateFormState, PartnerFormState } from '../constants';
import { useI18n } from '../i18n';
import { CandidateFormPage } from './CandidateFormPage';
import { PartnerFormPage } from './PartnerFormPage';

type RegisterPageProps = {
  mode: RegistrationMode;
  candidateForm: CandidateFormState;
  partnerForm: PartnerFormState;
  setMode: (mode: RegistrationMode) => void;
  setCandidateForm: (form: CandidateFormState) => void;
  setPartnerForm: (form: PartnerFormState) => void;
  onCandidateSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPartnerSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function RegisterPage({
  mode,
  candidateForm,
  partnerForm,
  setMode,
  setCandidateForm,
  setPartnerForm,
  onCandidateSubmit,
  onPartnerSubmit
}: RegisterPageProps) {
  const { t } = useI18n();

  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow"><Icon name="admin" /> {t('register.eyebrow')}</p>
        <h2>{t('register.title')}</h2>
        <p className="muted">{t('register.body')}</p>
      </div>

      <div className="account-type-grid" role="tablist" aria-label={t('register.chooseType')}>
        <button
          className={mode === 'graduate' ? 'account-type-card active' : 'account-type-card'}
          type="button"
          onClick={() => setMode('graduate')}
          aria-selected={mode === 'graduate'}
        >
          <Icon name="teachers" />
          <span>{t('register.graduate')}</span>
          <small>{t('register.graduateBody')}</small>
        </button>
        <button
          className={mode === 'partner' ? 'account-type-card active partner' : 'account-type-card partner'}
          type="button"
          onClick={() => setMode('partner')}
          aria-selected={mode === 'partner'}
        >
          <Icon name="partner" />
          <span>{t('register.partner')}</span>
          <small>{t('register.partnerBody')}</small>
        </button>
      </div>

      {mode === 'graduate' ? (
        <CandidateFormPage form={candidateForm} setForm={setCandidateForm} onSubmit={onCandidateSubmit} />
      ) : (
        <PartnerFormPage form={partnerForm} setForm={setPartnerForm} onSubmit={onPartnerSubmit} />
      )}
    </section>
  );
}
