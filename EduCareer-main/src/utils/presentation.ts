import type { IconName } from '../components/Icon';

export function getMetricIcon(label: string): IconName {
  if (label.toLowerCase().includes('teacher')) return 'teachers';
  if (label.toLowerCase().includes('ratio')) return 'ratio';
  if (label.toLowerCase().includes('program')) return 'programs';
  return 'region';
}

export function getProgramIcon(id: string): IconName {
  if (id === 'teachready') return 'placement';
  if (id === 'edumentor') return 'mentor';
  if (id === 'seminars') return 'seminar';
  return 'bridge';
}

export function getOpportunityIcon(type: string): IconName {
  if (type === 'Internship' || type === 'Assistant Teacher' || type === 'Practice Teaching') return 'placement';
  if (type === 'Mentorship') return 'mentor';
  if (type === 'Seminar') return 'seminar';
  return 'opportunities';
}
