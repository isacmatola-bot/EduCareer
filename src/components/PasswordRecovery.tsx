import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  completePasswordRecovery,
  requestPasswordRecovery,
  subscribeToPasswordRecovery
} from '../services/passwordRecovery';

type RecoveryCopy = {
  forgot: string;
  requestTitle: string;
  requestBody: string;
  identifier: string;
  send: string;
  sending: string;
  sent: string;
  cancel: string;
  requestError: string;
  resetTitle: string;
  resetBody: string;
  newPassword: string;
  confirmPassword: string;
  mismatch: string;
  update: string;
  updating: string;
  updated: string;
  returnToLogin: string;
};

const copy: Record<'en' | 'pt' | 'jp', RecoveryCopy> = {
  en: {
    forgot: 'Forgot password?',
    requestTitle: 'Reset your password',
    requestBody: 'Enter your EduCareer username or email. If an account matches, we will send a password reset link to its registered email address.',
    identifier: 'Username or email',
    send: 'Send recovery link',
    sending: 'Sending…',
    sent: 'If the account exists, a recovery link has been sent to the registered email address. Check your inbox and spam folder.',
    cancel: 'Cancel',
    requestError: 'Password recovery is temporarily unavailable. Please try again later.',
    resetTitle: 'Choose a new password',
    resetBody: 'Set a new password for your EduCareer account. Administrative MFA remains required after the reset.',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    mismatch: 'The passwords do not match.',
    update: 'Update password',
    updating: 'Updating…',
    updated: 'Your password has been updated successfully. Sign in again with the new password.',
    returnToLogin: 'Return to login'
  },
  pt: {
    forgot: 'Esqueceu a senha?',
    requestTitle: 'Recuperar a sua senha',
    requestBody: 'Introduza o seu username ou email da EduCareer. Se existir uma conta correspondente, enviaremos um link de recuperação para o email registado.',
    identifier: 'Username ou email',
    send: 'Enviar link de recuperação',
    sending: 'A enviar…',
    sent: 'Se a conta existir, foi enviado um link de recuperação para o email registado. Verifique também a pasta de spam.',
    cancel: 'Cancelar',
    requestError: 'A recuperação de senha está temporariamente indisponível. Tente novamente mais tarde.',
    resetTitle: 'Definir uma nova senha',
    resetBody: 'Defina uma nova senha para a sua conta EduCareer. O MFA administrativo continuará obrigatório após a recuperação.',
    newPassword: 'Nova senha',
    confirmPassword: 'Confirmar nova senha',
    mismatch: 'As senhas não coincidem.',
    update: 'Actualizar senha',
    updating: 'A actualizar…',
    updated: 'A sua senha foi actualizada com sucesso. Entre novamente usando a nova senha.',
    returnToLogin: 'Voltar ao login'
  },
  jp: {
    forgot: 'パスワードを忘れましたか？',
    requestTitle: 'パスワードをリセット',
    requestBody: 'EduCareerのユーザー名またはメールアドレスを入力してください。該当するアカウントがある場合、登録メールアドレスにリセットリンクを送信します。',
    identifier: 'ユーザー名またはメール',
    send: 'リセットリンクを送信',
    sending: '送信中…',
    sent: '該当するアカウントがある場合、登録メールアドレスにリセットリンクを送信しました。迷惑メールフォルダも確認してください。',
    cancel: 'キャンセル',
    requestError: '現在パスワード回復を利用できません。後でもう一度お試しください。',
    resetTitle: '新しいパスワードを設定',
    resetBody: 'EduCareerアカウントの新しいパスワードを設定してください。管理者MFAはリセット後も必要です。',
    newPassword: '新しいパスワード',
    confirmPassword: '新しいパスワードを確認',
    mismatch: 'パスワードが一致しません。',
    update: 'パスワードを更新',
    updating: '更新中…',
    updated: 'パスワードを更新しました。新しいパスワードで再度ログインしてください。',
    returnToLogin: 'ログインに戻る'
  }
};

function currentCopy(): RecoveryCopy {
  const language = document.documentElement.lang.toLowerCase();
  if (language.startsWith('pt')) return copy.pt;
  if (language.startsWith('ja') || language.startsWith('jp')) return copy.jp;
  return copy.en;
}

export function ForgotPasswordControl() {
  const text = currentCopy();
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');

    try {
      await requestPasswordRecovery(identifier);
      setSent(true);
    } catch {
      setError(text.requestError);
    } finally {
      setSending(false);
    }
  }

  function close() {
    setOpen(false);
    setIdentifier('');
    setSent(false);
    setError('');
  }

  return (
    <>
      <button className="secondary" type="button" onClick={() => setOpen(true)}>
        {text.forgot}
      </button>
      {open && createPortal(
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
          <section className="welcome-dialog mfa-dialog">
            <div className="welcome-panel">
              <p className="eyebrow">ACCOUNT RECOVERY</p>
              <h2 id="forgot-password-title">{text.requestTitle}</h2>
              <p>{text.requestBody}</p>
            </div>
            <form className="welcome-login-card" onSubmit={submit}>
              {sent ? (
                <>
                  <p role="status">{text.sent}</p>
                  <button type="button" onClick={close}>{text.cancel}</button>
                </>
              ) : (
                <>
                  <label>
                    {text.identifier}
                    <input
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                    />
                  </label>
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  <button type="submit" disabled={sending}>{sending ? text.sending : text.send}</button>
                  <button className="secondary" type="button" onClick={close}>{text.cancel}</button>
                </>
              )}
            </form>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

export function PasswordRecoveryBridge() {
  const text = useMemo(currentCopy, []);
  const [open, setOpen] = useState(() => window.location.hash.includes('type=recovery'));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeToPasswordRecovery(() => setOpen(true)), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(text.mismatch);
      return;
    }

    setSaving(true);
    try {
      await completePasswordRecovery(password);
      setCompleted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.requestError);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="password-recovery-title">
      <section className="welcome-dialog mfa-dialog">
        <div className="welcome-panel">
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h2 id="password-recovery-title">{text.resetTitle}</h2>
          <p>{text.resetBody}</p>
        </div>
        <form className="welcome-login-card" onSubmit={submit}>
          {completed ? (
            <>
              <p role="status">{text.updated}</p>
              <button type="button" onClick={() => window.location.replace('/')}>{text.returnToLogin}</button>
            </>
          ) : (
            <>
              <label>
                {text.newPassword}
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                {text.confirmPassword}
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button type="submit" disabled={saving}>{saving ? text.updating : text.update}</button>
            </>
          )}
        </form>
      </section>
    </div>,
    document.body
  );
}
