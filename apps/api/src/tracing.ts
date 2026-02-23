import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import {
  SimpleSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';

const isProduction = process.env.NODE_ENV === 'production';

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://jaeger:4318/v1/traces',
});

// 100% error traces, 10% success in production
const sampler = isProduction
  ? new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(0.1) })
  : new TraceIdRatioBasedSampler(1.0);

export const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'producer-animation-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
  }),
  spanProcessor: new SimpleSpanProcessor(exporter),
  sampler,
  instrumentations: [new HttpInstrumentation(), new NestInstrumentation(), new PgInstrumentation()],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
