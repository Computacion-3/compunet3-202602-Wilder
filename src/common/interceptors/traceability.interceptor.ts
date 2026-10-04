import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';

import { AppLogger } from '../logger/logger.service';

interface TraceableRequest extends Request {
    correlationId: string;
}

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLogger) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const http = context.switchToHttp();
        const request = http.getRequest<TraceableRequest>();
        const response = http.getResponse<Response>();
        const correlationId = request.get('x-correlation-id') || randomUUID();
        const startedAt = performance.now();

        request.correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);

        return new Observable<unknown>((subscriber) =>
            this.logger.runWithTrace(correlationId, () =>
                next
                    .handle()
                    .pipe(
                        finalize(() => {
                            const duration = Math.round(performance.now() - startedAt);
                            const status = `${response.statusCode} ${response.statusMessage}`;

                            this.logger.trace(
                                `[TRACE] [${request.method} ${request.originalUrl}] [${status}] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`,
                            );
                        }),
                    )
                    .subscribe(subscriber),
            ),
        );
    }
}
