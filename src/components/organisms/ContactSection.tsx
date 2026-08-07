import { SectionTitle } from "@/components/atoms/SectionTitle";
import { HostCard } from "@/components/molecules/HostCard";
import { CopyableValue } from "@/components/atoms/CopyableValue";
import type { Property } from "@/domain/property";

interface ContactSectionProps {
  property: Property;
}

export function ContactSection({ property }: ContactSectionProps) {
  const { host, address } = property;

  const fullAddress = [
    `${address.street}, ${address.number}`,
    address.complement,
    `${address.neighborhood} — ${address.city}, ${address.state}`,
    `CEP ${address.postal_code}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section aria-labelledby="contact-heading" className="space-y-6">
      <SectionTitle id="contact-heading">Contato</SectionTitle>

      <div>
        <h3 className="text-base font-medium text-warm-800 mb-3">
          Anfitrião
        </h3>
        <HostCard name={host.name} phone={host.phone} />
      </div>

      <div>
        <h3 className="text-base font-medium text-warm-800 mb-3">
          Endereço
        </h3>
        <CopyableValue value={fullAddress} label="Endereço completo" />
      </div>
    </section>
  );
}
