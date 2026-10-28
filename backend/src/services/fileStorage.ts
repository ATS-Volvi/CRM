import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface FileStorageHeadResult {
  contentLength: number;
  contentType: string;
  firstBytes?: Buffer;
}

export interface FileStoragePutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface FileStoragePresignUploadOptions {
  contentType: string;
  expiresInSeconds?: number;
}

export interface FileStoragePresignDownloadOptions {
  expiresInSeconds?: number;
  responseContentDisposition?: string;
}

export interface FileStorage {
  putObject(key: string, data: Buffer | Uint8Array, options?: FileStoragePutOptions): Promise<{ key: string; size: number }>;
  getObjectHead(key: string, maxBytesForMagic?: number): Promise<FileStorageHeadResult>;
  getSignedUploadUrl(key: string, options: FileStoragePresignUploadOptions): Promise<string>;
  getSignedDownloadUrl(key: string, options?: FileStoragePresignDownloadOptions): Promise<string>;
  deleteObject(key: string): Promise<void>;
  createReadStream?(key: string): NodeJS.ReadableStream;
}

export function getUploadRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, "../../uploads");
}

/**
 * Local File Storage Adapter
 */
export class LocalFileStorage implements FileStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || getUploadRoot();
  }

  private resolveSafePath(key: string): string {
    const safeKey = key.replace(/\\/g, "/");
    const fullPath = path.resolve(this.baseDir, safeKey);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error("Path traversal rejected");
    }
    return fullPath;
  }

  async putObject(key: string, data: Buffer | Uint8Array, options?: FileStoragePutOptions): Promise<{ key: string; size: number }> {
    const fullPath = this.resolveSafePath(key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
    return { key, size: data.length };
  }

  async getObjectHead(key: string, maxBytesForMagic: number = 64): Promise<FileStorageHeadResult> {
    const fullPath = this.resolveSafePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    const stat = fs.statSync(fullPath);
    const fd = fs.openSync(fullPath, "r");
    const readLen = Math.min(stat.size, maxBytesForMagic);
    const buf = Buffer.alloc(readLen);
    if (readLen > 0) {
      fs.readSync(fd, buf, 0, readLen, 0);
    }
    fs.closeSync(fd);

    return {
      contentLength: stat.size,
      contentType: "application/octet-stream",
      firstBytes: buf,
    };
  }

  async getSignedUploadUrl(key: string, options: FileStoragePresignUploadOptions): Promise<string> {
    // For local driver, presigned direct uploads can point to an internal endpoint or loopback URL
    const baseUrl = process.env.LOCAL_STORAGE_BASE_URL || "/api/v1/storage/local-upload";
    return `${baseUrl}?key=${encodeURIComponent(key)}`;
  }

  async getSignedDownloadUrl(key: string, options?: FileStoragePresignDownloadOptions): Promise<string> {
    const baseUrl = process.env.LOCAL_STORAGE_BASE_URL || "/api/v1/storage/local-download";
    return `${baseUrl}?key=${encodeURIComponent(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const fullPath = this.resolveSafePath(key);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      // Ignore not found
    }
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    const fullPath = this.resolveSafePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(fullPath);
  }
}

/**
 * S3-compatible File Storage Adapter (AWS S3, Cloudflare R2, Supabase Storage)
 */
export class S3FileStorage implements FileStorage {
  private client: S3Client;
  private bucket: string;

  constructor(client?: S3Client, bucket?: string) {
    this.bucket = bucket || process.env.S3_BUCKET || "";
    if (client) {
      this.client = client;
    } else {
      const region = process.env.S3_REGION || "us-east-1";
      const endpoint = process.env.S3_ENDPOINT || undefined;
      const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true" || process.env.S3_FORCE_PATH_STYLE === "1";
      const accessKeyId = process.env.S3_ACCESS_KEY_ID || "";
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";

      this.client = new S3Client({
        region,
        endpoint,
        forcePathStyle,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  getBucket(): string {
    return this.bucket;
  }

  getClient(): S3Client {
    return this.client;
  }

  async putObject(key: string, data: Buffer | Uint8Array, options?: FileStoragePutOptions): Promise<{ key: string; size: number }> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    });
    await this.client.send(cmd);
    return { key, size: data.length };
  }

  async getObjectHead(key: string, maxBytesForMagic: number = 64): Promise<FileStorageHeadResult> {
    // Read head metadata
    const headCmd = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const head = await this.client.send(headCmd);
    const contentLength = head.ContentLength || 0;
    const contentType = head.ContentType || "application/octet-stream";

    // Read the first bytes for magic byte verification
    let firstBytes: Buffer | undefined;
    if (contentLength > 0 && maxBytesForMagic > 0) {
      const rangeEnd = Math.min(contentLength - 1, maxBytesForMagic - 1);
      const getCmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=0-${rangeEnd}`,
      });
      const getRes = await this.client.send(getCmd);
      if (getRes.Body) {
        const stream = getRes.Body as any;
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        firstBytes = Buffer.concat(chunks);
      }
    }

    return {
      contentLength,
      contentType,
      firstBytes,
    };
  }

  async getSignedUploadUrl(key: string, options: FileStoragePresignUploadOptions): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
    });
    return getSignedUrl(this.client, cmd, {
      expiresIn: options.expiresInSeconds || 300,
    });
  }

  async getSignedDownloadUrl(key: string, options?: FileStoragePresignDownloadOptions): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options?.responseContentDisposition,
    });
    return getSignedUrl(this.client, cmd, {
      expiresIn: options?.expiresInSeconds || 60,
    });
  }

  async deleteObject(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(cmd);
  }
}

let activeStorage: FileStorage | null = null;

export function getFileStorage(): FileStorage {
  if (activeStorage) return activeStorage;
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "s3") {
    activeStorage = new S3FileStorage();
  } else {
    activeStorage = new LocalFileStorage();
  }
  return activeStorage;
}

export function setFileStorage(storage: FileStorage | null): void {
  activeStorage = storage;
}

/**
 * Generate a secure, unique object key for site inspection attachments.
 * Never uses the original user's filename.
 */
export function generateInspectionStorageKey(inspectionId: string, extWithDot: string): string {
  const cleanExt = extWithDot.toLowerCase().startsWith(".") ? extWithDot.toLowerCase() : `.${extWithDot.toLowerCase()}`;
  const randomUuid = crypto.randomUUID();
  return `site-inspections/${inspectionId}/${randomUuid}${cleanExt}`;
}
