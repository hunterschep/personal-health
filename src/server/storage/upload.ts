import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import sanitizeFilename from "sanitize-filename";
import { getServerEnv } from "@/config/env";
import { ValidationError } from "@/domain/shared/errors";
import { privateStorage } from "./local";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export type StoredUpload = {
  storageKey: string;
  sha256: string;
  originalFilename: string;
  safeFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type UploadFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export async function storeValidatedDocument(file: UploadFile): Promise<StoredUpload> {
  const environment = getServerEnv();
  if (file.size <= 0 || file.size > environment.MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Documents must be between 1 and ${environment.MAX_UPLOAD_BYTES} bytes.`,
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  if (detected === undefined || !allowedTypes.has(detected.mime) || !allowedTypes.has(file.type)) {
    throw new ValidationError("Only genuine PDF, JPEG, and PNG documents are accepted.");
  }
  const stored = await privateStorage.put({
    stream: Readable.from(bytes),
    contentType: detected.mime,
    size: bytes.length,
  });
  return {
    ...stored,
    originalFilename: file.name.slice(0, 255),
    safeFilename: sanitizeFilename(file.name, { replacement: "_" }).slice(0, 255) || "document",
    mimeType: detected.mime,
    sizeBytes: bytes.length,
  };
}
