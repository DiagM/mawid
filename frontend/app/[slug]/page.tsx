import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { formatDuration, formatPrice, weekdayLabel, WEEKDAY_ORDER } from "@/lib/format";
import { BookingWizard } from "./BookingWizard";

interface SalonPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SalonPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const salon = await api.getSalon(slug);
    return {
      title: `${salon.name} — Réserve en ligne | Mawid`,
      description:
        salon.description ??
        `Réserve ton rendez-vous chez ${salon.name} en quelques secondes, sans compte et sans appli.`,
    };
  } catch {
    return { title: "Salon introuvable | Mawid" };
  }
}

export default async function SalonPage({ params }: SalonPageProps) {
  const { slug } = await params;

  let salon;
  try {
    salon = await api.getSalon(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const cover = salon.photos[0];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      {cover && (
        <div className="relative h-52 w-full shrink-0 overflow-hidden bg-navy/10">
          {/* Domaines de photos non connus à l'avance (salon par salon) : */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={salon.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex-1 px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-navy">{salon.name}</h1>
        <p className="mt-1 text-sm text-navy/60">
          {salon.district}, {salon.city}
        </p>

        {salon.description && (
          <p className="mt-4 text-navy/80">{salon.description}</p>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-sand uppercase">
            Adresse
          </h2>
          <p className="mt-1 text-navy/80">{salon.addressLine}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-sand uppercase">
            Horaires
          </h2>
          <ul className="mt-2 overflow-hidden rounded-xl bg-white/60 ring-1 ring-navy/10">
            {WEEKDAY_ORDER.map((day) => {
              const hours = salon.openingHours[day];
              return (
                <li
                  key={day}
                  className="flex justify-between border-b border-navy/5 px-4 py-2 text-sm last:border-none"
                >
                  <span className="text-navy/70">{weekdayLabel(day)}</span>
                  <span
                    className={
                      hours ? "font-medium text-navy" : "text-navy/40"
                    }
                  >
                    {hours ? `${hours.open} – ${hours.close}` : "Fermé"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-sand uppercase">
            Prestations
          </h2>
          {salon.prestations.length === 0 ? (
            <p className="mt-2 text-sm text-navy/50">
              Aucune prestation disponible pour le moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {salon.prestations.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/60 px-4 py-3 ring-1 ring-navy/10"
                >
                  <div>
                    <p className="font-medium text-navy">{p.name}</p>
                    <p className="text-xs text-navy/50">
                      {formatDuration(p.durationMinutes)}
                    </p>
                  </div>
                  <p className="font-semibold text-navy">
                    {formatPrice(p.priceCents)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BookingWizard salon={salon} />
    </main>
  );
}
