import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { firstValueFrom, of } from 'rxjs';

import { AppLogger } from '../logger/logger.service';

import { TraceabilityInterceptor } from './traceability.interceptor';

describe('TraceabilityInterceptor', () => {
    let interceptor: TraceabilityInterceptor;
    let logger: Pick<AppLogger, 'runWithTrace' | 'trace'>;
    let response: Pick<Response, 'setHeader' | 'statusCode' | 'statusMessage'>;
    let request: Pick<Request, 'get' | 'method' | 'originalUrl'> & { correlationId?: string };

    beforeEach(() => {
        logger = {
            runWithTrace: (_correlationId, callback) => callback(),
            trace: jest.fn(),
        };
        interceptor = new TraceabilityInterceptor(logger as AppLogger);
        response = {
            setHeader: jest.fn(),
            statusCode: 200,
            statusMessage: 'OK',
        };
        request = {
            get: jest.fn(),
            method: 'GET',
            originalUrl: '/users',
        };
    });

    async function interceptAndCollect() {
        const context = {
            switchToHttp: () => ({
                getRequest: () => request,
                getResponse: () => response,
            }),
        } as ExecutionContext;
        const next: CallHandler = { handle: () => of({ users: [] }) };

        return firstValueFrom(interceptor.intercept(context, next));
    }

    it('returns the supplied correlation ID and leaves the response payload unchanged', async () => {
        jest.mocked(request.get).mockReturnValue('test-cid-12345');

        await expect(interceptAndCollect()).resolves.toEqual({ users: [] });

        expect(response.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-cid-12345');
        expect(request.correlationId).toBe('test-cid-12345');
        expect(jest.mocked(logger.trace).mock.calls[0][0]).toMatch(
            /^\[TRACE\] \[GET \/users\] \[200 OK\] \[Duration: \d+ms\] \[CorrelationID: test-cid-12345\]$/,
        );
    });

    it('generates and returns a UUID when the request has no correlation ID', async () => {
        jest.mocked(request.get).mockReturnValue(undefined);

        await interceptAndCollect();

        const correlationId = jest.mocked(response.setHeader).mock.calls[0][1];
        expect(correlationId).toEqual(expect.any(String));
        expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(request.correlationId).toBe(correlationId);
        expect(jest.mocked(logger.trace).mock.calls[0][0]).toMatch(
            /^\[TRACE\] \[GET \/users\] \[200 OK\] \[Duration: \d+ms\] \[CorrelationID: [0-9a-f-]+\]$/i,
        );
    });
});
