-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'GROUP';

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "Conversation"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "groupAvatarUrl" TEXT,
  ADD COLUMN "createdBy" TEXT;

ALTER TABLE "ConversationMember"
  ADD COLUMN "role" "MemberRole" NOT NULL DEFAULT 'MEMBER';

-- AddForeignKey
ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
