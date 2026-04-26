-- CreateEnum
CREATE TYPE "IncomingMessageStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "OutgoingMessageStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- CreateTable
CREATE TABLE "incoming_messages" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "from_phone" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "IncomingMessageStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "incoming_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outgoing_messages" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "wa_id" TEXT,
    "status" "OutgoingMessageStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outgoing_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_states" (
    "phone" TEXT NOT NULL,
    "last_intent" TEXT,
    "context_json" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "phone" TEXT NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE UNIQUE INDEX "incoming_messages_message_id_key" ON "incoming_messages"("message_id");
CREATE INDEX "incoming_messages_from_phone_idx" ON "incoming_messages"("from_phone");
CREATE INDEX "incoming_messages_status_idx" ON "incoming_messages"("status");
CREATE INDEX "incoming_messages_received_at_idx" ON "incoming_messages"("received_at");

-- CreateIndex
CREATE INDEX "outgoing_messages_phone_idx" ON "outgoing_messages"("phone");
CREATE INDEX "outgoing_messages_status_idx" ON "outgoing_messages"("status");
