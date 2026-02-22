import { v2 as cloudinary } from "cloudinary";
import { config } from "../config.js";

const isCloudinaryConfigured =
  Boolean(config.cloudinaryCloudName) &&
  Boolean(config.cloudinaryApiKey) &&
  Boolean(config.cloudinaryApiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret
  });
}

export async function uploadAudioBase64(base64Input, publicIdPrefix = "voice") {
  if (!base64Input) return null;
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  const { dataUri, extension } = normalizeAudioDataUri(base64Input);
  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "onevoice/audio",
    resource_type: "raw",
    public_id: `${publicIdPrefix}_${Date.now()}.${extension}`
  });
  return uploaded.secure_url;
}

function normalizeAudioDataUri(input) {
  const raw = String(input || "");
  if (raw.startsWith("data:")) {
    const parsed = parseDataUri(raw);
    if (!parsed?.base64) {
      throw new Error("Invalid base64 audio data URI");
    }
    const extension = mimeToExtension(parsed.mime);
    // Cloudinary rejects some parameterized MIME values like `audio/webm;codecs=opus`.
    // Rebuild a canonical base64 data URI without extra params.
    const safeDataUri = `data:${parsed.mime};base64,${parsed.base64}`;
    return { dataUri: safeDataUri, extension };
  }
  return { dataUri: `data:audio/wav;base64,${raw}`, extension: "wav" };
}

function parseDataUri(dataUri) {
  // Supports formats like:
  // data:audio/webm;codecs=opus;base64,AAAA...
  // data:audio/wav;base64,AAAA...
  const match = dataUri.match(/^data:([^;,]+)(?:;[^,]*)*;base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    base64: match[2]
  };
}

function mimeToExtension(mime) {
  if (!mime) return "wav";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  return "bin";
}
