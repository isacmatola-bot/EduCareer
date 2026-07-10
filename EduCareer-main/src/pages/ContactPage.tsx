import { Icon } from '../components/Icon';
import { contact } from '../data';
import { useI18n } from '../i18n';
import type { TabId } from '../types';

type ContactPageProps = {
  onNavigate: (tab: TabId) => void;
};

export function ContactPage({ onNavigate }: ContactPageProps) {
  const { t } = useI18n();

  return (
    <section className="form-layout">
      <div className="form-intro">
        <p className="eyebrow icon-eyebrow"><Icon name="contact" /> {t('contact.eyebrow')}</p>
        <h2>{t('contact.title')}</h2>
        <p>{t('contact.body')}</p>
        <div className="action-row">
          <button type="button" onClick={() => onNavigate('register')}>
            <Icon name="teachers" />
            {t('contact.graduateRegistration')}
          </button>
          <button className="secondary" type="button" onClick={() => onNavigate('partners')}>
            <Icon name="partner" />
            {t('contact.partnerRequest')}
          </button>
        </div>
      </div>

      <div className="section-stack">
        <article className="content-card">
          <h3><Icon name="contact" /> {t('contact.info')}</h3>
          <p>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
          <p>{t('form.phone')}: <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></p>
          <p>WhatsApp: <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}>{contact.whatsapp}</a></p>
          <p>{t('contact.address')}: {contact.address}</p>
        </article>

        <article className="content-card">
          <h3><Icon name="teachers" /> {t('contact.who')}</h3>
          <ul>
            <li>{t('contact.who1')}</li>
            <li>{t('contact.who2')}</li>
            <li>{t('contact.who3')}</li>
            <li>{t('contact.who4')}</li>
          </ul>
        </article>

        <article className="content-card">
          <h3><Icon name="mission" /> {t('contact.nextStep')}</h3>
          <p>{t('contact.nextStepBody')}</p>
        </article>
      </div>
    </section>
  );
}
