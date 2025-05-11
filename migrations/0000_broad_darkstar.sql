CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"tax_id" text,
	"start_hour" integer DEFAULT 9,
	"end_hour" integer DEFAULT 22,
	"logo_url" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "daily_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"date" text NOT NULL,
	"estimated_sales" numeric,
	"hourly_employee_cost" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "employee_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"level" integer
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '',
	"company_id" integer NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"hire_date" date,
	"contract_type" text,
	"hourly_rate" integer,
	"max_hours_per_week" integer,
	"preferred_days" text,
	"unavailable_days" text,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "schedule_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"start_hour" integer DEFAULT 8 NOT NULL,
	"end_hour" integer DEFAULT 20 NOT NULL,
	"time_increment" integer DEFAULT 15 NOT NULL,
	"is_global" boolean DEFAULT false,
	"company_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"company_id" integer NOT NULL,
	"template_id" integer,
	"start_date" text,
	"end_date" text,
	"status" text DEFAULT 'draft',
	"department" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"notes" text DEFAULT '',
	"status" text DEFAULT 'scheduled',
	"break_time" integer,
	"actual_start_time" text,
	"actual_end_time" text,
	"total_hours" integer,
	"schedule_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"role" text DEFAULT 'member',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"role" text DEFAULT 'user',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weekly_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_template_id_schedule_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."schedule_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_employees" ADD CONSTRAINT "weekly_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_employees" ADD CONSTRAINT "weekly_employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;