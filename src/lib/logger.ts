/** Server-side logger. Never import it from client components ('use client'), middleware or edge routes. */
import pino from 'pino';
import { otelPinoDestination } from './otel-logs';

export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, otelPinoDestination());
