import { SectionTitle } from "@/components/atoms/SectionTitle";
import { InfoRow } from "@/components/molecules/InfoRow";
import { PolicyRow } from "@/components/molecules/PolicyRow";
import { AmenityItem } from "@/components/molecules/AmenityItem";
import type { Property } from "@/domain/property";

interface StayRulesSectionProps {
  property: Property;
}

export function StayRulesSection({ property }: StayRulesSectionProps) {
  const { rules, amenities } = property;
  const trueAmenities = Object.entries(amenities).filter(([, value]) => value);

  return (
    <section aria-labelledby="rules-heading" className="space-y-6">
      <SectionTitle id="rules-heading">Regras e comodidades</SectionTitle>

      <div>
        <h3 className="text-base font-medium text-warm-800 dark:text-warm-200 mb-3">
          Horários
        </h3>
        <InfoRow label="Check-in" value={rules.check_in_time} />
        <InfoRow label="Check-out" value={rules.check_out_time} />
      </div>

      <div>
        <h3 className="text-base font-medium text-warm-800 dark:text-warm-200 mb-3">
          Políticas
        </h3>
        <PolicyRow
          label="Animais de estimação"
          allowed={rules.allow_pet}
        />
        <PolicyRow label="Fumantes" allowed={rules.smoking_permitted} />
        <PolicyRow
          label="Adequado para crianças"
          allowed={rules.suitable_for_children}
        />
        <PolicyRow
          label="Adequado para bebês"
          allowed={rules.suitable_for_babies}
        />
        <PolicyRow
          label="Eventos e festas"
          allowed={rules.events_permitted}
        />
      </div>

      {trueAmenities.length > 0 && (
        <div>
          <h3 className="text-base font-medium text-warm-800 dark:text-warm-200 mb-3">
            Comodidades
          </h3>
          <div className="flex flex-wrap gap-2">
            {trueAmenities.map(([key]) => (
              <AmenityItem key={key} amenityKey={key} hasIt={true} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
