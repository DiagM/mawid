import { fr } from '@/lib/i18n/fr';

/**
 * ============================================
 * Logo Mawid
 * ============================================
 * موعد — « rendez-vous » en arabe — calligraphié en Ruq'ah (Aref Ruqaa), le
 * style manuscrit le plus courant au Maghreb. Il dit à la fois le métier et
 * le pays, ce qu'un logotype latin ne ferait pas.
 *
 * L'arabe porte le sens, le latin porte la prononciation : les deux sont
 * affichés ensemble, sauf en version compacte où le mot arabe suffit.
 *
 * `dir="rtl"` sur le mot arabe : sans lui, la ponctuation et l'espacement
 * environnants peuvent se réordonner de façon imprévisible au milieu d'un
 * texte français.
 */
export function Logo({
  size = 'md',
  withWordmark = true,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  /** `false` n'affiche que le mot arabe — pour une barre étroite. */
  withWordmark?: boolean;
  className?: string;
}) {
  const arabicSize =
    size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-3xl' : 'text-2xl';
  const latinSize =
    size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label={fr.app.name}
    >
      <span
        dir="rtl"
        lang="ar"
        aria-hidden="true"
        className={`font-arabic leading-none text-accent ${arabicSize}`}
      >
        موعد
      </span>

      {withWordmark && (
        <span className="flex flex-col leading-tight">
          <span
            aria-hidden="true"
            className={`font-display tracking-wide text-foreground ${latinSize}`}
          >
            {fr.app.name}
          </span>
          {size !== 'sm' && (
            <span
              aria-hidden="true"
              className="text-[0.65rem] uppercase tracking-[0.18em] text-muted"
            >
              {fr.app.logoTagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
