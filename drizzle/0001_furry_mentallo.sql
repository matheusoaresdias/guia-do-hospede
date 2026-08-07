CREATE TABLE "property_pois" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"pois" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_pois_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
ALTER TABLE "experience_guides" ADD COLUMN "source" text DEFAULT 'llm' NOT NULL;--> statement-breakpoint
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;