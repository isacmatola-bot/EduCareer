import type { Metric, Opportunity, Program } from './types';

export const contact = {
  email: '2kgmcorp@gmail.com',
  phone: '+258 820 227 503',
  whatsapp: '+258 820 227 503',
  address: 'Beira City, Macurrungo 5th Street, Sofala Province, Mozambique'
};

export const metrics: Metric[] = [
  {
    label: 'Graduate Teachers',
    value: '500+',
    helper: 'Targeted for career support and professional readiness.'
  },
  {
    label: 'Student–Teacher Ratio',
    value: '100:1+',
    helper: 'Current pressure in many participating public schools.'
  },
  {
    label: 'Core Programs',
    value: '4',
    helper: 'Career connection, internship, mentorship, and seminars.'
  },
  {
    label: 'Primary Region',
    value: 'Sofala',
    helper: 'Built for local impact, scalable beyond the province.'
  }
];

export const objectives = [
  'Employment Connection – link graduates with opportunities in public and private schools.',
  'Practical Experience Programs – facilitate assistant teacher, reinforcement class, and practice teaching placements.',
  'Capacity Building – offer workshops on classroom management, digital pedagogy, and professional readiness.',
  'Partnership Development – collaborate with teacher training colleges, universities, schools, and education authorities.',
  'Mentoring and Networking – connect experienced educators with new graduates through a structured mentorship scheme.'
];

export const beneficiaries = [
  'Postgraduate students from teacher training institutes in Sofala Province.',
  'Trainee teachers seeking structured field experience.',
  'Public and private schools in need of qualified and motivated educators.'
];

export const programs: Program[] = [
  {
    id: 'edulink',
    name: 'EduLink – Career Connection Platform',
    tagline: 'Connecting qualified educators to real opportunities.',
    description: 'A digital bridge between teacher trainees, postgraduate students, schools, and education employers.',
    activities: [
      'Candidate profile registration and readiness screening.',
      'Publication of school vacancies and teaching opportunities.',
      'Matching of graduates to schools based on subject area, location, and availability.',
      'Follow-up records for placements and employment outcomes.'
    ]
  },
  {
    id: 'teachready',
    name: 'TeachReady Internship Program',
    tagline: 'Practical classroom exposure before full employment.',
    description: 'Structured placements for assistant teachers, reinforcement class teachers, and practice teachers in public and private schools.',
    activities: [
      'School placement coordination.',
      'Internship attendance and supervisor tracking.',
      'Classroom support for schools with high student–teacher ratios.',
      'Performance feedback reports for trainees.'
    ]
  },
  {
    id: 'edumentor',
    name: 'EduMentor Network',
    tagline: 'Guidance from experienced educators.',
    description: 'A mentorship network connecting early-career educators with professionals who can guide their transition into the labour market.',
    activities: [
      'Mentor and mentee registration.',
      'Monthly mentoring sessions.',
      'Career planning support.',
      'Professional ethics and classroom confidence coaching.'
    ]
  },
  {
    id: 'seminars',
    name: 'Professional Growth Seminars',
    tagline: 'Skills for employability and better teaching practice.',
    description: 'Workshops and seminars focused on classroom management, digital pedagogy, job readiness, and education leadership.',
    activities: [
      'Classroom management workshops.',
      'Digital pedagogy training.',
      'CV, interview, and professional readiness sessions.',
      'Education labour market seminars.'
    ]
  }
];

export const opportunities: Opportunity[] = [
  {
    id: 'opp-001',
    title: 'Assistant Teacher Placement – Primary Education',
    institution: 'Partner Public School Network',
    location: 'Beira, Sofala',
    type: 'Assistant Teacher',
    deadline: '2026-08-15',
    status: 'Open',
    requirements: ['Teacher training background', 'Availability for classroom support', 'Strong communication skills']
  },
  {
    id: 'opp-002',
    title: 'TeachReady Internship – Secondary Education',
    institution: 'EduCareer Placement Desk',
    location: 'Sofala Province',
    type: 'Internship',
    deadline: '2026-09-01',
    status: 'Upcoming',
    requirements: ['Postgraduate or final-year trainee', 'Subject specialization', 'Commitment to school-based practice']
  },
  {
    id: 'opp-003',
    title: 'EduMentor Monthly Cohort',
    institution: 'EduMentor Network',
    location: 'Hybrid',
    type: 'Mentorship',
    deadline: '2026-07-30',
    status: 'Open',
    requirements: ['New graduate or trainee teacher', 'Clear career development goals', 'Willingness to attend mentoring sessions']
  },
  {
    id: 'opp-004',
    title: 'Digital Pedagogy Seminar',
    institution: 'Professional Growth Seminars',
    location: 'Beira, Sofala',
    type: 'Seminar',
    deadline: '2026-08-05',
    status: 'Open',
    requirements: ['Interest in digital teaching tools', 'Basic computer literacy', 'Teaching or training background']
  }
];
