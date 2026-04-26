-- Dead Letter Queue for WhatsApp failed messages
-- Migration: 20260403_dead_letter_queue

-- Enum for failed message status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FailedMessageStatus') THEN
        CREATE TYPE "FailedMessageStatus" AS ENUM ('pending', 'retrying', 'resolved', 'discarded');
    END IF;
END $$;

-- Failed messages table
CREATE TABLE IF NOT EXISTS "failed_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" TEXT NOT NULL,
    "job_id" TEXT,
    "from_phone" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "error_message" TEXT NOT NULL,
    "error_stack" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "last_attempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FailedMessageStatus" NOT NULL DEFAULT 'pending',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_messages_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "failed_messages_message_id_key" ON "failed_messages"("message_id");
CREATE INDEX IF NOT EXISTS "failed_messages_status_idx" ON "failed_messages"("status");
CREATE INDEX IF NOT EXISTS "failed_messages_from_phone_idx" ON "failed_messages"("from_phone");
CREATE INDEX IF NOT EXISTS "failed_messages_created_at_idx" ON "failed_messages"("created_at");

-- Comment
COMMENT ON TABLE "failed_messages" IS 'Dead Letter Queue: mensajes WhatsApp que fallaron después de agotar reintentos';
