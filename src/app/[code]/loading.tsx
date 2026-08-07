import { Skeleton } from '@/components/atoms/Skeleton';

export default function PropertyLoading() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div aria-hidden="true" className="space-y-10">
        {/* Hero */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl overflow-hidden">
            <div className="sm:col-span-2 sm:row-span-2">
              <Skeleton className="aspect-[4/3] w-full" />
            </div>
            <Skeleton className="aspect-[4/3] hidden sm:block" />
            <Skeleton className="aspect-[4/3] hidden sm:block" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        {/* Acesso */}
        <div className="space-y-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>

        {/* Regras */}
        <div className="space-y-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>

        {/* Contato */}
        <div className="space-y-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </main>
  );
}
