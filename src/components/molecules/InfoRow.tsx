interface InfoRowProps {
  label: string;
  value: string;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 py-1">
      <span className="text-sm font-medium text-warm-500 dark:text-warm-400">
        {label}
      </span>
      <span className="text-base text-warm-900 dark:text-warm-100">
        {value}
      </span>
    </div>
  );
}
