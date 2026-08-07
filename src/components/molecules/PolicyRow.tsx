import { Badge } from "@/components/atoms/Badge";

interface PolicyRowProps {
  label: string;
  allowed: boolean;
  allowedLabel?: string;
  notAllowedLabel?: string;
}

export function PolicyRow({
  label,
  allowed,
  allowedLabel = "Permitido",
  notAllowedLabel = "Não permitido",
}: PolicyRowProps) {
  return (
    <div className="flex items-center justify-between py-2 gap-4">
      <span className="text-base text-warm-900">
        {label}
      </span>
      <Badge variant={allowed ? "positivo" : "negativo"}>
        {allowed ? allowedLabel : notAllowedLabel}
      </Badge>
    </div>
  );
}
