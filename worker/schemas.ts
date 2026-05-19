import { z } from "zod";

export const ImportJobData = z.object({
  importId: z.string().uuid(),
});
export type ImportJobData = z.infer<typeof ImportJobData>;

// enrichCatalog reads all unenriched rows from the DB directly; no job payload needed.
export const EnrichCatalogJobData = z.object({});
export type EnrichCatalogJobData = z.infer<typeof EnrichCatalogJobData>;
