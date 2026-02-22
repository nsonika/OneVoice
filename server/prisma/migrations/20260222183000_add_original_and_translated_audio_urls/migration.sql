-- Preserve existing translated audio links by renaming audioUrl.
ALTER TABLE "Message" RENAME COLUMN "audioUrl" TO "translatedAudioUrl";

-- Add a separate column for original uploaded voice URL.
ALTER TABLE "Message" ADD COLUMN "originalAudioUrl" TEXT;
