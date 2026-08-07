import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
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
  generated_at: timestamp('generated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
