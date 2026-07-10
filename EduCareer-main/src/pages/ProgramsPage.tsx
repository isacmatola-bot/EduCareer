import { Icon } from '../components/Icon';
import { programs } from '../data';
import { localizeProgram, useI18n } from '../i18n';
import { getProgramIcon } from '../utils/presentation';

export function ProgramsPage() {
  const { language, t } = useI18n();

  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow"><Icon name="programs" /> {t('programs.eyebrow')}</p>
        <h2>{t('programs.title')}</h2>
      </div>
      <div className="program-grid">
        {programs.map((program) => {
          const localizedProgram = localizeProgram(language, program);

          return (
            <article className="program-card program-card-with-icon" key={program.id}>
              <span className="program-icon"><Icon name={getProgramIcon(program.id)} /></span>
              <p className="eyebrow">{localizedProgram.tagline}</p>
              <h3>{localizedProgram.name}</h3>
              <p>{localizedProgram.description}</p>
              <ul>
                {localizedProgram.activities.map((activity) => <li key={activity}>{activity}</li>)}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
