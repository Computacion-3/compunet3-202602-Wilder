import { AppLogger } from './logger.service';

describe('AppLogger', () => {
    let logger: AppLogger;
    let write: jest.SpyInstance;
    let consoleLog: jest.SpyInstance;

    beforeEach(() => {
        logger = new AppLogger();
        const stream = (logger as unknown as { logStream: NodeJS.WritableStream }).logStream;
        write = jest.spyOn(stream, 'write').mockReturnValue(true);
        consoleLog = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        write.mockRestore();
        consoleLog.mockRestore();
        logger.onModuleDestroy();
    });

    it('includes the correlation ID in logs written from asynchronous request context', async () => {
        await logger.runWithTrace('test-cid-12345', async () => {
            await new Promise<void>((resolve) => setImmediate(resolve));
            logger.debug('business event');
        });

        expect(write).toHaveBeenCalledWith(expect.stringContaining('[CorrelationID: test-cid-12345]'));
        expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[CorrelationID: test-cid-12345]'));
    });

    it('allows an explicit correlation ID for a log entry', () => {
        logger.logWithTrace('explicit-cid', 'info', 'request completed');

        expect(write).toHaveBeenCalledWith(
            expect.stringContaining('[INFO] [CorrelationID: explicit-cid] request completed'),
        );
    });
});
