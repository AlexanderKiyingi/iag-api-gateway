import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  SERVICE_NAME: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export const kafkaEnvSchema = baseEnvSchema.extend({
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().optional(),
});

export const postgresEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().url(),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }
  return parsed.data;
}

export { baseEnvSchema };
