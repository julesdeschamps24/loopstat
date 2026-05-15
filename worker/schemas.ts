import { z } from "zod";

export const PollUserJobData = z.object({
  userId: z.string().uuid(),
});
export type PollUserJobData = z.infer<typeof PollUserJobData>;

export const ImportJobData = z.object({
  importId: z.string().uuid(),
});
export type ImportJobData = z.infer<typeof ImportJobData>;

export const EnrichJobData = z.object({
  userId: z.string().uuid(),
});
export type EnrichJobData = z.infer<typeof EnrichJobData>;
