import type { Metadata } from 'next';
import { getMe } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { requireSessionToken } from '@/lib/session';
import { PasswordForm } from './password-form';

export const metadata: Metadata = {
  title: fr.pro.changePassword,
  robots: { index: false, follow: false },
};

export default async function PasswordPage() {
  const token = await requireSessionToken();
  const me = await getMe(token);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="text-xl font-semibold">
        {me.mustChangePassword
          ? fr.pro.changePasswordForced
          : fr.pro.changePassword}
      </h1>

      {me.mustChangePassword && (
        <p className="mb-6 mt-2 text-muted">
          {fr.pro.changePasswordForcedHelp}
        </p>
      )}

      <div className={me.mustChangePassword ? '' : 'mt-6'}>
        <PasswordForm />
      </div>
    </main>
  );
}
