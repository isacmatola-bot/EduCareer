export type TabId =
  | 'home'
  | 'about'
  | 'programs'
  | 'opportunities'
  | 'register'
  | 'partners'
  | 'contact'
  | 'portal'
  | 'dashboard';

export type Program = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  activities: string[];
};

export type Opportunity = {
  id: string;
  title: string;
  institution: string;
  location: string;
  type: 'Assistant Teacher' | 'Internship' | 'Mentorship' | 'Seminar' | 'Practice Teaching';
  deadline: string;
  status: 'Open' | 'Upcoming' | 'Closed';
  requirements: string[];
};

export type CandidateApplication = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  province: string;
  institution: string;
  qualification: string;
  teachingArea: string;
  preferredProgram: string;
  motivation: string;
  createdAt: string;
};

export type PartnerRequest = {
  id: string;
  username: string;
  organizationName: string;
  contactPerson: string;
  email: string;
  phone: string;
  organizationType: string;
  supportNeeded: string;
  createdAt: string;
};

export type Metric = {
  label: string;
  value: string;
  helper: string;
};
