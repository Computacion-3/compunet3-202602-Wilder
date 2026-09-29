import { randomUUID } from 'crypto';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';

interface TraceableRequest extends Request {
    correlationId: string;
}

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const http = context.switchToHttp();
        const request = http.getRequest<TraceableRequest>();
        const response = http.getResponse<Response>();
        const correlationId = request.get('x-correlation-id') || randomUUID();
        const startedAt = Date.now();

        request.correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);

        return next.handle().pipe(
            finalize(() => {
                const duration = Date.now() - startedAt;
                const status = `${response.statusCode} ${response.statusMessage}`;

                // eslint-disable-next-line no-console
                console.info(
                    `[TRACE] [${request.method} ${request.originalUrl}] [${status}] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`,
                );
            }),
        );
    }
}
