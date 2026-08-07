import { SectionTitle } from "@/components/atoms/SectionTitle";
import { WifiCard } from "@/components/molecules/WifiCard";
import { CopyableValue } from "@/components/atoms/CopyableValue";
import { InfoRow } from "@/components/molecules/InfoRow";
import type { Property } from "@/domain/property";

interface AccessSectionProps {
  property: Property;
}

export function AccessSection({ property }: AccessSectionProps) {
  const { operational } = property;

  return (
    <section aria-labelledby="access-heading" className="space-y-6">
      <SectionTitle id="access-heading">Acesso</SectionTitle>

      <div>
        <h3 className="text-base font-medium text-warm-800 dark:text-warm-200 mb-3">
          WiFi
        </h3>
        <WifiCard
          network={operational.wifi_network}
          password={operational.wifi_password}
        />
      </div>

      <div>
        <h3 className="text-base font-medium text-warm-800 dark:text-warm-200 mb-3">
          Entrada
        </h3>
        <CopyableValue
          value={operational.property_password}
          label={
            operational.is_self_checkin
              ? "Código de acesso"
              : "Código do cofre"
          }
        />
        <p className="mt-3 text-sm text-warm-600 dark:text-warm-400">
          {operational.property_access_instructions}
        </p>
      </div>

      <div>
        <h3 className="text-base font-medium text-warm-800 dark:text-warm-200 mb-3">
          Estacionamento
        </h3>
        {operational.has_parking_spot ? (
          <div className="space-y-2">
            {operational.parking_spot_identifier && (
              <InfoRow
                label="Vaga"
                value={operational.parking_spot_identifier}
              />
            )}
            {operational.parking_spot_instructions && (
              <p className="text-sm text-warm-600 dark:text-warm-400">
                {operational.parking_spot_instructions}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-warm-500 dark:text-warm-400">
            Este imóvel não possui vaga de estacionamento.
          </p>
        )}
      </div>
    </section>
  );
}
