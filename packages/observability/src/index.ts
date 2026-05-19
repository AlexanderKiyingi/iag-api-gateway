import pino, { type Logger, type LoggerOptions } from "pino";

export interface LoggerConfig {
  serviceName: string;
  level?: string;
}

export function createLogger(config: LoggerConfig): Logger {
  const options: LoggerOptions = {
    name: config.serviceName,
    level: config.level ?? process.env.LOG_LEVEL ?? "info",
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    base: {
      service: config.serviceName,
    },
  };

  return pino(options);
}

export type { Logger };
