import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { isInPast } from "@/lib/format";
import { CancellationView } from "./CancellationView";

interface CancellationPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Ton rendez-vous | Mawid",
  robots: { index: false, follow: false },
};

export default async function CancellationPage({
  params,
}: CancellationPageProps) {
  const { token } = await params;

  let reservation;
  try {
    reservation = await api.getReservationByToken(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const isPast = isInPast(reservation.startsAt);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">
      <p className="text-sm font-semibold tracking-wide text-sand uppercase">
        Ton rendez-vous
      </p>
      <h1 className="mt-1 text-2xl font-bold text-navy">
        {reservation.salonName}
      </h1>

      <div className="mt-6">
        <CancellationView
          token={token}
          initialReservation={reservation}
          initialIsPast={isPast}
        />
      </div>
    </main>
  );
}
