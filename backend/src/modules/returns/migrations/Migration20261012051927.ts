import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261012051927 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "return_request" ("id" text not null, "order_id" text not null, "customer_id" text not null, "type" text check ("type" in ('return', 'exchange')) not null, "status" text check ("status" in ('requested', 'approved', 'rejected', 'picked_up', 'received', 'refund_due', 'refunded', 'completed', 'cancelled')) not null default 'requested', "items" jsonb not null, "photos" jsonb null, "refund_details" jsonb null, "refund_amount" integer null, "refund_reference" text null, "reject_reason" text null, "medusa_return_id" text null, "medusa_exchange_id" text null, "pickup" jsonb null, "pickup_awb" text null, "locale" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "return_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_deleted_at" ON "return_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_order_id" ON "return_request" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_customer_id" ON "return_request" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_status" ON "return_request" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_pickup_awb" ON "return_request" ("pickup_awb") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "return_request" cascade;`);
  }

}
