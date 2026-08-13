import type { Metadata } from "next";
import { SalonConfigView } from "./SalonConfigView";

export const metadata: Metadata = {
  title: "Mon salon — Mawid Pro",
  robots: { index: false, follow: false },
};

export default function SalonPage() {
  return <SalonConfigView />;
}
