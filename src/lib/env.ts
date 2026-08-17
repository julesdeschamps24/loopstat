import { z } from "zod";

/**
 * Validation des variables d'environnement serveur, exécutée une fois au
 * boot (via instrumentation.ts pour Next, et worker/index.ts pour le
 * worker). Fail fast : une prod mal configurée crashe au démarrage au lieu
 * d'échouer silencieusement à la première requête.
 *
 * En dev, seules DATABASE_URL/REDIS_URL ont des défauts raisonnables ; les
 * variables d'auth sont requises partout (le login est cassé sans elles).
 */
const workerEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .startsWith("postgres", "DATABASE_URL doit être une URL postgres://"),
  REDIS_URL: z.string().startsWith("redis://").default("redis://127.0.0.1:6379"),
});

// L'app Next a besoin en plus des variables d'auth. Le worker non (il ne
// reçoit que DATABASE_URL + REDIS_URL dans docker-compose.prod.yml).
const serverEnvSchema = workerEnvSchema.extend({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET trop court (openssl rand -base64 32)"),
  AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function fail(issues: z.core.$ZodIssue[]): never {
  const details = issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Variables d'environnement invalides au boot :\n${details}`);
}

export function validateServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) fail(parsed.error.issues);
  return parsed.data;
}

export function validateWorkerEnv(): z.infer<typeof workerEnvSchema> {
  const parsed = workerEnvSchema.safeParse(process.env);
  if (!parsed.success) fail(parsed.error.issues);
  return parsed.data;
}
