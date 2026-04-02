import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { appConfig } from "@/server/config/app-config";

const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptProviderApiKey(apiKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    authTag.toString("base64url")
  ].join(":");
}

export function decryptProviderApiKey(value: string): string {
  const [version, ivEncoded, encryptedEncoded, authTagEncoded] = value.split(":");

  if (version !== ENCRYPTION_VERSION || !ivEncoded || !encryptedEncoded || !authTagEncoded) {
    throw new Error("Provider API key ciphertext is invalid.");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivEncoded, "base64url")
  );

  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(appConfig.security.providerKeyEncryptionSecret, "utf8").digest();
}
