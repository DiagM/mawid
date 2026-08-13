import type { Metadata } from "next";
import { AgendaView } from "./AgendaView";

export const metadata: Metadata = {
  title: "Agenda — Mawid Pro",
  robots: { index: false, follow: false },
};

export default function AgendaPage() {
  return <AgendaView />;
}
