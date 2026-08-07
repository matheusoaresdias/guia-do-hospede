import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findPropertyByCode } from "@/server/repositories/properties";
import { GuidebookTemplate } from "@/components/templates/GuidebookTemplate";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  const property = await findPropertyByCode(code);
  if (!property) {
    return { title: "Imóvel não encontrado" };
  }
  return {
    title: `${property.name} — Guia Digital do Hóspede`,
    description: `Guia completo do ${property.property_type} em ${property.address.city}, ${property.address.state}`,
  };
}

export default async function PropertyPage({ params }: PageProps) {
  const { code } = await params;
  const property = await findPropertyByCode(code);

  if (!property) {
    notFound();
  }

  return (
    <GuidebookTemplate
      property={property}
      // experienceSlot e assistantSlot virão na próxima leva
    />
  );
}
