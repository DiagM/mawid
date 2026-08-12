import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-2/3" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </main>
  );
}
