import { redirect } from "next/navigation";

/** `/pro` seul n'a pas de contenu propre : l'agenda est l'écran par défaut. */
export default function ProIndexPage() {
  redirect("/pro/agenda");
}
