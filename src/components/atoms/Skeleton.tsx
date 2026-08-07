interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-warm-200 ${className}`}
      role="status"
      aria-label="Carregando"
    />
  );
}
