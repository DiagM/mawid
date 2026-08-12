import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <Skeleton className="h-52 w-full shrink-0 rounded-none" />
      <div className="flex-1 space-y-6 px-5 pt-6 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </main>
  );
}
