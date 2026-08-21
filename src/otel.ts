import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import {
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type Sampler,
} from "@opentelemetry/sdk-trace-base";
import {
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

/**
 * Sampler from the standard OTEL_TRACES_SAMPLER / OTEL_TRACES_SAMPLER_ARG vars,
 * matching what platform-go/otel does for the Go services.
 *
 * The gateway had no sampler at all, so NodeSDK defaulted to
 * ParentBased(AlwaysOn) — a span exported for every request through the one
 * process every request passes through. Under load the batch processor's queue
 * overflows and drops spans anyway, after the event loop has already paid to
 * build and serialize them.
 *
 * Parent-based in every case: a sampling decision made upstream is honoured, so
 * a trace is never half-recorded. A bad ratio degrades to MORE traces, never
 * none — losing telemetry is the worse failure and the harder one to notice.
 */
export function samplerFromEnv(env: NodeJS.ProcessEnv = process.env): Sampler {
  const name = (env.OTEL_TRACES_SAMPLER ?? "parentbased_traceidratio").trim();
  const rawArg = env.OTEL_TRACES_SAMPLER_ARG?.trim();

  switch (name) {
    case "always_on":
    case "parentbased_always_on":
      return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    case "traceidratio":
    case "parentbased_traceidratio": {
      const parsed = rawArg === undefined || rawArg === "" ? NaN : Number(rawArg);
      const ratio =
        Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
          ? parsed
          : DEFAULT_TRACE_RATIO;
      return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) });
    }
    default:
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(DEFAULT_TRACE_RATIO),
      });
  }
}

/**
 * 10% when nothing is configured. Enough to characterise latency and catch a
 * regression at the volumes this gateway sees, without exporting a span per
 * request. Raise OTEL_TRACES_SAMPLER_ARG while chasing something specific.
 */
const DEFAULT_TRACE_RATIO = 0.1;

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
    sampler: samplerFromEnv(),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        // The gateway proxies; it does not resolve names or open raw sockets on
        // its own behalf in any way a span would explain. These fire per
        // request and produce noise that nobody reads, on the busiest process
        // in the platform.
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
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
