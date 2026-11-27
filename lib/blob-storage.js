import { promises as fs } from "node:fs";
import path from "node:path";

import { Storage } from "@google-cloud/storage";

import { getOptionalAuthClient } from "./gcp-auth.js";

// Ablage fuer erzeugte Rechnungsdateien (PDF/PNG).
// Mit GCS_BUCKET in Google Cloud Storage (Praefix generated/), sonst lokal im Dateisystem.
export function createBlobStorage({ bucketName, localDir, projectId } = {}) {
  if (bucketName) {
    const authClient = getOptionalAuthClient();
    const bucket = new Storage({ projectId: projectId || undefined, ...(authClient ? { authClient } : {}) }).bucket(
      bucketName
    );
    const objectName = (fileName) => `generated/${path.basename(fileName)}`;

    return {
      kind: "gcs",
      async writeGenerated(fileName, buffer, contentType) {
        await bucket.file(objectName(fileName)).save(buffer, {
          resumable: false,
          contentType: contentType || undefined,
          metadata: { cacheControl: "private, no-store" }
        });
      },
      async readGenerated(fileName) {
        try {
          const [buffer] = await bucket.file(objectName(fileName)).download();
          return buffer;
        } catch (error) {
          if (error?.code === 404) {
            return null;
          }
          throw error;
        }
      }
    };
  }

  return {
    kind: "local",
    async writeGenerated(fileName, buffer) {
      await fs.mkdir(localDir, { recursive: true });
      await fs.writeFile(path.join(localDir, path.basename(fileName)), buffer);
    },
    async readGenerated(fileName) {
      try {
        return await fs.readFile(path.join(localDir, path.basename(fileName)));
      } catch {
        return null;
      }
    }
  };
}
