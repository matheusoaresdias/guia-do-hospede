import type { Property } from "@/domain/property";
import { PropertyHero } from "@/components/organisms/PropertyHero";
import { AccessSection } from "@/components/organisms/AccessSection";
import { StayRulesSection } from "@/components/organisms/StayRulesSection";
import { ContactSection } from "@/components/organisms/ContactSection";

interface GuidebookTemplateProps {
  property: Property;
  experienceSlot?: React.ReactNode;
  assistantSlot?: React.ReactNode;
}

export function GuidebookTemplate({
  property,
  experienceSlot,
  assistantSlot,
}: GuidebookTemplateProps) {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-10">
      <nav
        aria-label="Seções do guia"
        className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
      >
        <a
          href="#access-heading"
          className="text-brand-600 hover:underline"
        >
          Acesso
        </a>
        <span className="text-warm-300" aria-hidden="true">
          ·
        </span>
        <a
          href="#rules-heading"
          className="text-brand-600 hover:underline"
        >
          Regras
        </a>
        {experienceSlot && (
          <>
            <span
              className="text-warm-300"
              aria-hidden="true"
            >
              ·
            </span>
            <a
              href="#experience-heading"
              className="text-brand-600 hover:underline"
            >
              Experiências
            </a>
          </>
        )}
        {assistantSlot && (
          <>
            <span
              className="text-warm-300"
              aria-hidden="true"
            >
              ·
            </span>
            <a
              href="#assistant-heading"
              className="text-brand-600 hover:underline"
            >
              Assistente
            </a>
          </>
        )}
        <span className="text-warm-300" aria-hidden="true">
          ·
        </span>
        <a
          href="#contact-heading"
          className="text-brand-600 hover:underline"
        >
          Contato
        </a>
      </nav>

      <PropertyHero property={property} />
      <AccessSection property={property} />
      <StayRulesSection property={property} />

      {experienceSlot && (
        <section id="experience-heading">{experienceSlot}</section>
      )}

      {assistantSlot && (
        <section id="assistant-heading">{assistantSlot}</section>
      )}

      <ContactSection property={property} />
    </main>
  );
}
