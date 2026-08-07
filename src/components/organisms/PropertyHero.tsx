import Image from "next/image";
import type { Property } from "@/domain/property";

interface PropertyHeroProps {
  property: Property;
}

export function PropertyHero({ property }: PropertyHeroProps) {
  const capacityParts: string[] = [
    `${property.bedroom_quantity} quarto${property.bedroom_quantity > 1 ? "s" : ""}`,
    `${property.bathroom_quantity} banheiro${property.bathroom_quantity > 1 ? "s" : ""}`,
    `até ${property.guest_capacity} hóspedes`,
  ];
  const capacityText = capacityParts.join(" · ");

  return (
    <section aria-labelledby="property-heading" className="space-y-4">
      {property.images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl overflow-hidden">
          <div className="relative aspect-[4/3] sm:col-span-2 sm:row-span-2">
            <Image
              src={property.images[0]}
              alt={`Foto principal de ${property.name}`}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 640px) 100vw, 66vw"
            />
          </div>
          {property.images.slice(1, 3).map((url, index) => (
            <div key={url} className="relative aspect-[4/3] hidden sm:block">
              <Image
                src={url}
                alt={`Foto ${index + 2} de ${property.name}`}
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {property.property_type} em {property.address.city},{" "}
          {property.address.state}
        </p>
        <h1
          id="property-heading"
          className="text-2xl font-semibold text-warm-900 dark:text-warm-100"
        >
          {property.name}
        </h1>
        <p className="text-sm text-warm-600 dark:text-warm-400">
          {capacityText}
        </p>
      </div>
    </section>
  );
}
