# EduCareer – Empowering Future Educators

EduCareer is a non-profit application designed for Sofala Province, Mozambique. It helps postgraduate students and teacher trainees transition from academic study into meaningful employment in the education sector by connecting candidates, schools, mentors, training institutions, and education employers.

## Current MVP

This first version is a deployable frontend prototype with local demo storage. It includes:

- Public landing page with organization overview, vision, mission, strategic objectives, target beneficiaries, and expected impact.
- Programs page for EduLink, TeachReady, EduMentor, and Professional Growth Seminars.
- Opportunities page for career, internship, mentorship, and seminar listings.
- Graduate registration form.
- Partner school/institution request form.
- Admin dashboard showing candidate applications, partner requests, open opportunities, and active programs.
- Supabase SQL schema prepared for the next phase.

## Recommended stack

- Frontend: React + TypeScript + Vite
- Repository: GitHub
- Deployment: Vercel
- Future database/auth: Supabase PostgreSQL + Supabase Auth

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal, usually:

```text
http://localhost:3000
```

## Build for production

```bash
npm run build
```

## Upload to GitHub from the terminal

Create an empty repository on GitHub called `educareer`, then run these commands inside the project folder:

```bash
git init
git add .
git commit -m "Initial EduCareer app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/educareer.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

## Deploy to Vercel

1. Go to Vercel.
2. Import the GitHub repository.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

Vercel supports Vite projects and creates deployments from connected repositories. Vercel also supports environment variables, which we will use later for Supabase keys.

## Supabase next phase

When ready to use real database storage:

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Add the following variables to `.env.local` and to Vercel Environment Variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

5. Replace localStorage functions with Supabase insert/select calls.

## Suggested next features

- Admin login and protected dashboard.
- Candidate profile management.
- Opportunity creation by administrators.
- AI matching between candidates and opportunities.
- Placement tracking and supervisor feedback.
- Email notifications for applications and partner requests.
- Bilingual interface: English and Portuguese.
