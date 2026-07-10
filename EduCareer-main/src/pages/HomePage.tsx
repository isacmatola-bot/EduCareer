import type { RegistrationMode } from '../auth';
import { Icon } from '../components/Icon';
import { metrics } from '../data';
import { localizeMetric, useI18n } from '../i18n';
import type { TabId } from '../types';
import { getMetricIcon } from '../utils/presentation';

type HomePageProps = {
  onNavigate: (tab: TabId) => void;
  onStartRegistration: (mode: RegistrationMode) => void;
};

export function HomePage({ onNavigate, onStartRegistration }: HomePageProps) {
  const { language, t } = useI18n();

  return (
    <section className="section-stack">
      <div className="hero-grid">
        <div className="hero-card">
          <p className="eyebrow hero-eyebrow">
            <Icon name="bridge" />
            {t('home.eyebrow')}
          </p>
          <h2>{t('home.title')}</h2>
          <p>{t('home.body')}</p>
          <div className="hero-proof-row" aria-label="EduCareer operating focus">
            <span>{t('home.proof.region')}</span>
            <span>{t('home.proof.pathways')}</span>
            <span>{t('home.proof.partnerships')}</span>
          </div>
          <div className="action-row">
            <button type="button" onClick={() => onStartRegistration('graduate')}>
              <Icon name="teachers" />
              {t('home.registerGraduate')}
            </button>
            <button className="secondary" type="button" onClick={() => onStartRegistration('partner')}>
              <Icon name="partner" />
              {t('home.becomePartner')}
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate('contact')}>
              <Icon name="contact" />
              {t('home.contact')}
            </button>
          </div>
        </div>

        <div className="impact-card mission-vision-card">
          <p className="eyebrow icon-eyebrow">
            <Icon name="vision" />
            {t('home.missionVision')}
          </p>
          <div className="mini-statement">
            <strong>
              <Icon name="vision" />
              {t('home.vision')}
            </strong>
            <p>{t('home.visionBody')}</p>
          </div>

          <div className="mini-statement">
            <strong>
              <Icon name="mission" />
              {t('home.mission')}
            </strong>
            <p>{t('home.missionBody')}</p>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => {
          const localizedMetric = localizeMetric(language, metric);

          return (
            <article className="metric-card metric-card-with-icon" key={metric.label}>
              <span className="metric-icon"><Icon name={getMetricIcon(metric.label)} /></span>
              <strong>{localizedMetric.value}</strong>
              <span>{localizedMetric.label}</span>
              <p>{localizedMetric.helper}</p>
            </article>
          );
        })}
      </div>

      <section className="gallery-testimonial-frame">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow icon-eyebrow">
              <Icon name="impact" />
              {t('home.community')}
            </p>
            <h3>{t('home.galleryTitle')}</h3>
            <p className="muted">{t('home.galleryBody')}</p>
          </div>
          <button className="secondary" type="button" onClick={() => onNavigate('contact')}>
            <Icon name="contact" />
            {t('home.shareActivity')}
          </button>
        </div>

        <div className="gallery-grid">
          <div className="gallery-tile">
            <span><Icon name="seminar" /></span>
            <strong>{t('home.seminars')}</strong>
            <p>{t('home.seminarsBody')}</p>
          </div>
          <div className="gallery-tile">
            <span><Icon name="placement" /></span>
            <strong>{t('home.placements')}</strong>
            <p>{t('home.placementsBody')}</p>
          </div>
          <div className="gallery-tile">
            <span><Icon name="mentor" /></span>
            <strong>{t('home.mentorship')}</strong>
            <p>{t('home.mentorshipBody')}</p>
          </div>
        </div>

        <div className="testimonial-grid">
          <blockquote className="testimonial-card">
            “{t('home.testimonialGraduate')}”
            <cite>{t('home.testimonialGraduateBy')}</cite>
          </blockquote>
          <blockquote className="testimonial-card">
            “{t('home.testimonialPartner')}”
            <cite>{t('home.testimonialPartnerBy')}</cite>
          </blockquote>
        </div>
      </section>
    </section>
  );
}
