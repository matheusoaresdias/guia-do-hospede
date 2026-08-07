import { Badge } from "@/components/atoms/Badge";

const amenityLabels: Record<string, string> = {
  wifi: "WiFi",
  tv: "TV",
  air_conditioning: "Ar-condicionado",
  kitchen: "Cozinha completa",
  washing_machine: "Máquina de lavar",
  elevator: "Elevador",
  balcony: "Varanda",
  bbq_grill: "Churrasqueira",
  dishwasher: "Lava-louças",
  pool: "Piscina",
};

interface AmenityItemProps {
  amenityKey: string;
  hasIt: boolean;
}

export function AmenityItem({ amenityKey, hasIt }: AmenityItemProps) {
  if (!hasIt) return null;

  const label = amenityLabels[amenityKey] ?? formatUnknownKey(amenityKey);

  return <Badge variant="neutro">{label}</Badge>;
}

function formatUnknownKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
