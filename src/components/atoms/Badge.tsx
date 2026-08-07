type BadgeVariant = "neutro" | "positivo" | "negativo";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutro:
    "bg-warm-200 text-warm-800",
  positivo:
    "bg-success-soft text-success",
  negativo:
    "bg-error-soft text-error",
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
