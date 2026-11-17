/**
 * Sends this app's logs to OpenTelemetry (-> local agent -> Loki).
 * Company standard: copy unchanged.
 *   Next.js -> lib/otel-logs.ts   (src/lib/otel-logs.ts if the project uses src/)
 *   NestJS  -> src/otel-logs.ts
 *
 * Logs are handed to the OpenTelemetry Logs API explicitly. Nothing depends on
 * patching a logging library at load time, so it keeps working when a bundler
 * (e.g. Turbopack) or the import order prevents that patching. Records written
 * while a request is handled carry that request's trace_id / span_id.
 *
 *   console.*  -> call forwardConsoleToOtel() once, right after sdk.start()
 *   pino       -> pino(options, otelPinoDestination())
 *   NestJS     -> see otel-nest-logger.ts
 */
import { logs, SeverityNumber, type AnyValueMap } from '@opentelemetry/api-logs';
import { format } from 'node:util';

export type OtelLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

const SEVERITY: Record<OtelLevel, SeverityNumber> = {
  TRACE: SeverityNumber.TRACE,
  DEBUG: SeverityNumber.DEBUG,
  INFO: SeverityNumber.INFO,
  WARN: SeverityNumber.WARN,
  ERROR: SeverityNumber.ERROR,
  FATAL: SeverityNumber.FATAL,
};
const ANSI_COLORS = /\x1b\[[0-9;]*m/g;

/** Emits one log record. Never throws: telemetry must never break the app. */
export function emitOtelLog(scope: string, level: OtelLevel, body: string, attributes?: AnyValueMap): void {
  try {
    logs.getLogger(scope).emit({
      severityNumber: SEVERITY[level],
      severityText: level,
      body: body.replace(ANSI_COLORS, ''),
      attributes,
    });
  } catch {
    // ignore
  }
}

/** Also sends every console.debug/log/info/warn/error to OpenTelemetry. Output still goes to the console. */
export function forwardConsoleToOtel(): void {
  const g = globalThis as { __otelConsoleForwarded?: boolean };
  if (g.__otelConsoleForwarded) return;
  g.__otelConsoleForwarded = true;

  const methods: Array<['debug' | 'log' | 'info' | 'warn' | 'error', OtelLevel]> = [
    ['debug', 'DEBUG'], ['log', 'INFO'], ['info', 'INFO'], ['warn', 'WARN'], ['error', 'ERROR'],
  ];
  let forwarding = false;
  for (const [method, level] of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: any[]) => {
      original(...args);
      if (forwarding) return; // never loop if something below logs to the console
      forwarding = true;
      try {
        emitOtelLog('console', level, format(args[0], ...args.slice(1)));
      } finally {
        forwarding = false;
      }
    };
  }
}

const PINO_LEVELS: Record<number, OtelLevel> = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };

/**
 * pino destination: writes each line to `next` (stdout by default, or the app's existing
 * destination) AND sends it to OpenTelemetry. Usage: pino(options, otelPinoDestination())
 */
export function otelPinoDestination(next: { write(line: string): unknown } = process.stdout) {
  return {
    write(line: string) {
      next.write(line);
      try {
        const { level, msg, time, pid, hostname, trace_id, span_id, trace_flags, ...attributes } = JSON.parse(line);
        const otelLevel: OtelLevel =
          typeof level === 'number'
            ? PINO_LEVELS[level] ?? 'INFO'
            : (String(level).toUpperCase() as OtelLevel) in SEVERITY ? (String(level).toUpperCase() as OtelLevel) : 'INFO';
        emitOtelLog('pino', otelLevel, typeof msg === 'string' ? msg : '', attributes);
      } catch {
        // not JSON (e.g. pino-pretty): the line is still written to `next`
      }
    },
  };
}
