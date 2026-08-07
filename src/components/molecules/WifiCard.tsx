import { CopyableValue } from "@/components/atoms/CopyableValue";

interface WifiCardProps {
  network: string;
  password: string;
}

export function WifiCard({ network, password }: WifiCardProps) {
  return (
    <div className="space-y-3">
      <CopyableValue value={network} label="Rede" />
      <CopyableValue value={password} label="Senha" />
    </div>
  );
}
