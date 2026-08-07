type BadgeVariant = "neutro" | "positivo" | "negativo";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutro:
    "bg-warm-200 text-warm-800 dark:bg-warm-700 dark:text-warm-200",
  positivo:
    "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
  negativo:
    "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
};

export function Badge({ children, variant = "neutro" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
