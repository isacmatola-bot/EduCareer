import { useEffect, useState, type FormEvent } from 'react';
import { adminRoleRequiresMfa, type UserAccount } from '../../auth';
import {
  getAdminMfaState,
  startAdminMfaEnrollment,
  verifyAdminMfa,
  type AdminMfaEnrollment
} from '../../services/supabaseStore';

type AdminMfaGateProps = {
  account: UserAccount;
  onVerified: () => void;
  onLogout: () => void;
};

export function AdminMfaGate({ account, onVerified, onLogout }: AdminMfaGateProps) {
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string>();
  const [enrollment, setEnrollment] = useState<AdminMfaEnrollment>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const required = adminRoleRequiresMfa(account);

  useEffect(() => {
    let active = true;
    async function prepare() {
      if (!required || account.mustChangePassword) {
        onVerified();
        return;
      }
      try {
        const state = await getAdminMfaState();
        if (!active) return;
        if (state.currentLevel === 'aal2') {
          onVerified();
          return;
        }
        if (state.verifiedFactorId) {
          setFactorId(state.verifiedFactorId);
        } else {
          setEnrollment(await startAdminMfaEnrollment());
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Não foi possível preparar o MFA.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void prepare();
    return () => { active = false; };
  }, [account.mustChangePassword, onVerified, required]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFactor = enrollment?.factorId ?? factorId;
    if (!selectedFactor || !/^\d{6}$/.test(code.trim())) {
      setError('Introduza o código de 6 dígitos do aplicativo autenticador.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyAdminMfa(selectedFactor, code);
      // The first Supabase snapshot is intentionally loaded while the admin is still AAL1.
      // Reload after successful elevation so RLS-protected account/domain reads run with AAL2.
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Código MFA inválido.');
      setLoading(false);
    }
  }

  if (!required || account.mustChangePassword) return null;

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
      <div className="welcome-dialog mfa-dialog">
        <section className="welcome-panel">
          <p className="eyebrow">PROTEÇÃO ADMINISTRATIVA</p>
          <h2 id="mfa-title">Autenticação multifator obrigatória</h2>
          <p>Use um aplicativo autenticador para proteger a conta {account.displayName}.</p>
          {enrollment && (
            <>
              <img className="mfa-qr-code" src={enrollment.qrCode} alt="QR Code para configurar o autenticador" />
              <p><strong>Chave manual:</strong> <code>{enrollment.secret}</code></p>
            </>
          )}
        </section>
        <form className="welcome-login-card" onSubmit={submit}>
          <h3>{enrollment ? 'Configurar autenticador' : 'Confirmar segundo fator'}</h3>
          <p className="muted">
            {enrollment
              ? 'Digitalize o QR Code e introduza o código gerado.'
              : 'Introduza o código atual do seu aplicativo autenticador.'}
          </p>
          <label>
            Código de 6 dígitos
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'A verificar…' : 'Verificar e continuar'}</button>
          <button className="secondary" type="button" onClick={onLogout}>Terminar sessão</button>
        </form>
      </div>
    </div>
  );
}
