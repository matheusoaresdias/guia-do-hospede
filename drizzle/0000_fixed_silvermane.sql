CREATE TABLE "experience_guides" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"season" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experience_guides_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"property_type" text NOT NULL,
	"bedroom_quantity" integer NOT NULL,
	"bathroom_quantity" integer NOT NULL,
	"guest_capacity" integer NOT NULL,
	"address" jsonb NOT NULL,
	"operational" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"amenities" jsonb NOT NULL,
	"images" jsonb NOT NULL,
	"host" jsonb NOT NULL,
	CONSTRAINT "properties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "experience_guides" ADD CONSTRAINT "experience_guides_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;