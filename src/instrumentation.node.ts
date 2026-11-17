import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { forwardConsoleToOtel } from './lib/otel-logs';

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      // lib/otel-logs.ts sends pino logs itself; this keeps trace_id in pino lines without sending them twice
      '@opentelemetry/instrumentation-pino': { disableLogSending: true },
      // Next.js creates its own request span; avoid a duplicate generic one.
      '@opentelemetry/instrumentation-http': { disableIncomingRequestInstrumentation: true },
    }),
  ],
});

sdk.start();
// Server-side console.* is also sent to Grafana (output still goes to the console)
forwardConsoleToOtel();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
