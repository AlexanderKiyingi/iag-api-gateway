import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import {
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

export interface OTelOptions {
  serviceName: string;
  endpoint: string;
  environment?: string;
  serviceVersion?: string;
}

/**
 * Initialise OpenTelemetry tracing. Must be called BEFORE constructing any
 * HTTP client/server so auto-instrumentation can patch fetch and http.
 */
export async function initOTel(options: OTelOptions): Promise<void> {
  if (!options.endpoint) {
    return;
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      ...(options.serviceVersion
        ? { [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion }
        : {}),
      "deployment.environment.name": options.environment ?? "development",
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${options.endpoint.replace(/\/$/, "")}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
}

/** Flush and shut down the tracer provider. */
export async function shutdownOTel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
