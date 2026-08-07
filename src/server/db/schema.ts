import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import type {
  Address,
  Operational,
  Rules,
  Amenities,
  Images,
  Host,
} from '../../domain/property';
import type { ExperienceGuide } from '../../domain/experience-guide';
import type { RawPoiCandidate } from '../geo/overpass';

/** Tabela de imóveis */
export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  property_type: text('property_type').notNull(),
  bedroom_quantity: integer('bedroom_quantity').notNull(),
  bathroom_quantity: integer('bathroom_quantity').notNull(),
  guest_capacity: integer('guest_capacity').notNull(),
  address: jsonb('address').notNull().$type<Address>(),
  operational: jsonb('operational').notNull().$type<Operational>(),
  rules: jsonb('rules').notNull().$type<Rules>(),
  amenities: jsonb('amenities').notNull().$type<Amenities>(),
  images: jsonb('images').notNull().$type<Images>(),
  host: jsonb('host').notNull().$type<Host>(),
});

/** Tabela de guias de experiência gerados por IA */
export const experienceGuides = pgTable('experience_guides', {
  id: serial('id').primaryKey(),
  property_id: integer('property_id')
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull().$type<ExperienceGuide>(),
  model: text('model').notNull(),
  season: text('season').notNull(),
  source: text('source').notNull().default('llm'),
  generated_at: timestamp('generated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Cache permanente de geocode + POIs do OpenStreetMap por imóvel */
export const propertyPois = pgTable('property_pois', {
  id: serial('id').primaryKey(),
  property_id: integer('property_id')
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: 'cascade' }),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  pois: jsonb('pois').notNull().$type<RawPoiCandidate[]>(),
  fetched_at: timestamp('fetched_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
