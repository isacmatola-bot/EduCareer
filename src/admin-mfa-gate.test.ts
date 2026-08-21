import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gate = readFileSync(new URL('./features/admin/AdminMfaGate.tsx', import.meta.url), 'utf8');

describe('admin MFA privileged data refresh', () => {
  it('reloads the application after successful AAL2 verification', () => {
    expect(gate).toContain('await verifyAdminMfa(selectedFactor, code)');
    expect(gate).toContain('window.location.reload()');
  });

  it('does not reload when the existing session is already AAL2', () => {
    const alreadyAal2Branch = gate.slice(
      gate.indexOf("if (state.currentLevel === 'aal2')"),
      gate.indexOf('if (state.verifiedFactorId)')
    );
    expect(alreadyAal2Branch).toContain('onVerified()');
    expect(alreadyAal2Branch).not.toContain('window.location.reload()');
  });
});
