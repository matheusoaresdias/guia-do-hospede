import { z } from 'zod';

// --- Bloco Endereço ---
export const addressSchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().nullable(),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postal_code: z.string().min(1),
});
export type Address = z.infer<typeof addressSchema>;

// --- Bloco Operacional ---
export const operationalSchema = z.object({
  wifi_network: z.string().min(1),
  wifi_password: z.string().min(1),
  is_self_checkin: z.boolean(),
  property_access_type: z.string().min(1),
  property_access_instructions: z.string().min(1),
  property_password: z.string().min(1),
  has_parking_spot: z.boolean(),
  parking_spot_identifier: z.string().nullable(),
  parking_spot_instructions: z.string().nullable(),
});
export type Operational = z.infer<typeof operationalSchema>;

// --- Bloco Regras ---
export const rulesSchema = z.object({
  check_in_time: z.string().min(1),
  check_out_time: z.string().min(1),
  allow_pet: z.boolean(),
  smoking_permitted: z.boolean(),
  suitable_for_children: z.boolean(),
  suitable_for_babies: z.boolean(),
  events_permitted: z.boolean(),
});
export type Rules = z.infer<typeof rulesSchema>;

// --- Bloco Comodidades ---
// Zod v4 exige schema de chave e de valor em z.record.
// Amenidades são um dicionário aberto: cada imóvel expõe o subconjunto que possui.
export const amenitiesSchema = z.record(z.string(), z.boolean());
export type Amenities = z.infer<typeof amenitiesSchema>;

// --- Bloco Imagens ---
export const imagesSchema = z.array(z.url());
export type Images = z.infer<typeof imagesSchema>;

// --- Bloco Anfitrião ---
export const hostSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
});
export type Host = z.infer<typeof hostSchema>;

// --- Imóvel completo (shape do seed) ---
export const propertySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  property_type: z.string().min(1),
  bedroom_quantity: z.number().int().positive(),
  bathroom_quantity: z.number().int().positive(),
  guest_capacity: z.number().int().positive(),
  address: addressSchema,
  operational: operationalSchema,
  rules: rulesSchema,
  amenities: amenitiesSchema,
  images: imagesSchema,
  host: hostSchema,
});
export type Property = z.infer<typeof propertySchema>;

/**
 * Normaliza o código do imóvel: trim + uppercase.
 */
export function normalizePropertyCode(code: string): string {
  return code.trim().toUpperCase();
}
