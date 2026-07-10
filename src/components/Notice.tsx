import { useI18n } from '../i18n';

type NoticeProps = {
  message: string;
  onDismiss: () => void;
};

export function Notice({ message, onDismiss }: NoticeProps) {
  const { t } = useI18n();

  if (!message) {
    return null;
  }

  return (
    <div className="notice-overlay" role="dialog" aria-modal="true" aria-labelledby="notice-title">
      <div className="notice-dialog">
        <p className="eyebrow" id="notice-title">{t('notice.title')}</p>
        <p>{message}</p>
        <button type="button" onClick={onDismiss} autoFocus>
          {t('actions.ok')}
        </button>
      </div>
    </div>
  );
}
