import { RequestHandler } from "express";

export interface ScanResult {
  clean: boolean;
  reason?: string;
  safeAttachments?: Array<{ filename: string; mime: string; buffer: Buffer }>;
}

export interface PipelineMeta {
  source: string;
  ip?: string;
  attachments?: Array<{ filename: string; buffer: Buffer }>;
}

export function leadSecurityPipeline(): RequestHandler[];
export function runPipeline(rawLead: any, meta?: PipelineMeta): Promise<any>;
