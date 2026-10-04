import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

import { Injectable, LoggerService, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class AppLogger implements LoggerService, OnModuleDestroy {
    private logStream: fs.WriteStream;
    private readonly traceContext = new AsyncLocalStorage<{ correlationId: string }>();

    constructor() {
        const dateStamp = new Date().toISOString().split('T')[0];
        const logDir = path.join(process.cwd(), 'logs');

        // Garantiza la existencia del directorio de almacenamiento
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logFile = path.join(logDir, `app-${dateStamp}.log`);
        // Abre el stream en modo append ('a')
        this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
    }

    log(message: string) {
        this.write('LOG', message);
    }

    error(message: string, trace?: string) {
        this.write('ERROR', message, trace);
    }

    warn(message: string) {
        this.write('WARN', message);
    }

    debug(message: string) {
        this.write('DEBUG', message);
    }

    verbose(message: string) {
        this.write('VERBOSE', message);
    }

    runWithTrace<T>(correlationId: string, callback: () => T): T {
        return this.traceContext.run({ correlationId }, callback);
    }

    logWithTrace(correlationId: string, level: string, message: string): void {
        this.write(level.toUpperCase(), message, undefined, correlationId);
    }

    trace(message: string): void {
        this.logStream.write(`${message}\n`);

        console.info(message);
    }

    private write(level: string, message: string, trace?: string, explicitCorrelationId?: string) {
        const timestamp = new Date().toISOString();
        const correlationId = explicitCorrelationId ?? this.traceContext.getStore()?.correlationId;
        const correlationField = correlationId ? ` [CorrelationID: ${correlationId}]` : '';
        const formattedLog = `[${timestamp}] [${level}]${correlationField} ${message}${trace ? '\n[Stack Trace]: ' + trace : ''}\n`;

        // Escritura persistente en disco
        this.logStream.write(formattedLog);

        // Salida formateada en consola
        // eslint-disable-next-line no-console
        console.log(formattedLog.trim());
    }

    onModuleDestroy() {
        if (this.logStream) {
            this.logStream.end();
        }
    }
}
