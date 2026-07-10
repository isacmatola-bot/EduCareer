import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import type { TabId } from '../types';

type AboutPageProps = {
  onNavigate: (tab: TabId) => void;
};

export function AboutPage({ onNavigate }: AboutPageProps) {
  const { t } = useI18n();
  const objectives = [
    t('about.objective1'),
    t('about.objective2'),
    t('about.objective3'),
    t('about.objective4'),
    t('about.objective5')
  ];
  const beneficiaries = [t('about.beneficiary1'), t('about.beneficiary2'), t('about.beneficiary3')];
  const fundingItems = [t('about.funding1'), t('about.funding2'), t('about.funding3'), t('about.funding4')];
  const impactItems = [
    t('about.impact1'),
    t('about.impact2'),
    t('about.impact3'),
    t('about.impact4'),
    t('about.impact5')
  ];

  return (
    <section className="section-stack">
      <div className="section-heading">
        <p className="eyebrow icon-eyebrow">
          <Icon name="about" />
          {t('about.eyebrow')}
        </p>
        <h2>{t('about.title')}</h2>
        <p className="muted">{t('about.body')}</p>
      </div>

      <div className="about-layout">
        <article className="content-card about-wide">
          <h3><Icon name="about" /> {t('about.overview')}</h3>
          <p>{t('about.overviewBody1')}</p>
          <p>{t('about.overviewBody2')}</p>
        </article>

        <article className="content-card">
          <h3><Icon name="programs" /> {t('about.objectives')}</h3>
          <div className="objective-list">
            {objectives.map((objective, index) => (
              <div key={objective} className="objective-item">
                <span>{index + 1}</span>
                <p>{objective}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="content-card">
          <h3><Icon name="teachers" /> {t('about.beneficiaries')}</h3>
          <div className="pill-row">
            {beneficiaries.map((beneficiary) => <span key={beneficiary}>{beneficiary}</span>)}
          </div>
        </article>

        <article className="content-card">
          <h3><Icon name="admin" /> {t('about.governance')}</h3>
          <p>{t('about.governanceBody1')}</p>
          <p>{t('about.governanceBody2')}</p>
        </article>

        <article className="content-card">
          <h3><Icon name="partner" /> {t('about.funding')}</h3>
          <ul>
            {fundingItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="content-card about-wide">
          <h3><Icon name="impact" /> {t('about.impact')}</h3>
          <ul>
            {impactItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="action-row">
            <button type="button" onClick={() => onNavigate('programs')}>
              <Icon name="programs" />
              {t('about.explorePrograms')}
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate('register')}>
              <Icon name="teachers" />
              {t('home.registerGraduate')}
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate('partners')}>
              <Icon name="partner" />
              {t('home.becomePartner')}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
