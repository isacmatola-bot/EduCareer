import type { TabId } from './types';
import type { IconName } from './components/Icon';
import type { LanguageCode } from './i18n';

export const candidateKey = 'educareer:candidates';
export const partnerKey = 'educareer:partners';
export const accountKey = 'educareer:accounts';
export const sessionKey = 'educareer:session';
export const languageKey = 'educareer:language';

export const tabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'about', label: 'About Us', icon: 'about' },
  { id: 'programs', label: 'Programs', icon: 'programs' },
  { id: 'opportunities', label: 'Opportunities', icon: 'opportunities' }
];

export const languages: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'jp', label: '日本語' }
];

export const blankCandidate = {
  username: '',
  password: '',
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

export type CandidateFormState = typeof blankCandidate;

export const blankPartner = {
  username: '',
  password: '',
  organizationName: '',
  contactPerson: '',
  email: '',
  phone: '',
  organizationType: 'Public School',
  supportNeeded: ''
};

export type PartnerFormState = typeof blankPartner;
