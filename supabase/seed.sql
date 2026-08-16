-- EduCareer demo/staging seed data.
-- Supabase runs this file after migrations during local start/db reset.
-- Do not apply this file to the production project.

insert into public.programs (
  id,
  name,
  tagline,
  description,
  activities,
  status
)
values
  (
    'teacher-bridge',
    'Teacher Bridge',
    'From postgraduate study to classroom impact',
    'A practical transition program connecting graduate educators with supervised teaching experience.',
    array['Career preparation', 'Teaching practice', 'Mentor matching'],
    'published'
  ),
  (
    'digital-education-lab',
    'Digital Education Lab',
    'Practical tools for modern learning',
    'Hands-on workshops that help educators use accessible digital tools in schools and training programs.',
    array['Digital lesson design', 'Learning platforms', 'Peer demonstrations'],
    'published'
  ),
  (
    'education-leadership-circle',
    'Education Leadership Circle',
    'Growing the next generation of education leaders',
    'A mentoring and seminar series for graduates preparing for coordination and leadership responsibilities.',
    array['Leadership seminars', 'Mentoring', 'Community projects'],
    'draft'
  )
on conflict (id) do update
set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  activities = excluded.activities,
  status = excluded.status,
  updated_at = now();

insert into public.opportunities (
  id,
  title,
  institution,
  location,
  opportunity_type,
  deadline,
  status,
  requirements
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Assistant Teacher Placement',
    'EduCareer Partner School',
    'Beira, Sofala',
    'Assistant Teacher',
    date '2027-03-31',
    'open',
    array['Postgraduate education candidate', 'Available for supervised teaching', 'Portuguese communication skills']
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Education Technology Internship',
    'Digital Education Lab',
    'Beira, Sofala',
    'Internship',
    date '2027-04-30',
    'open',
    array['Interest in education technology', 'Basic computer literacy', 'Portfolio or motivation statement']
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Graduate Mentorship Cohort',
    'EduCareer',
    'Sofala Province',
    'Mentorship',
    date '2027-05-15',
    'upcoming',
    array['Graduate or final-year postgraduate student', 'Commitment to monthly mentoring sessions']
  )
on conflict (id) do update
set
  title = excluded.title,
  institution = excluded.institution,
  location = excluded.location,
  opportunity_type = excluded.opportunity_type,
  deadline = excluded.deadline,
  status = excluded.status,
  requirements = excluded.requirements,
  updated_at = now();
