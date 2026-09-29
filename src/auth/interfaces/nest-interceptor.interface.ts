import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface NestInterceptor<T = any, R = any> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<R>;
}
