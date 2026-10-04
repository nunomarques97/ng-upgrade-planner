import { EMPTY, iif, of, VirtualTimeScheduler } from 'rxjs';
import { defaultIfEmpty, map } from 'rxjs/operators';
import { Observable } from 'rxjs/Rx';

export const onlyTrue$ = iif(() => true, of(1));
export const noResults$ = iif(() => true);
export const both$ = iif(() => true, of(1), EMPTY);
export const noDefault$ = of(1).pipe(defaultIfEmpty());
export const withDefault$ = of(1).pipe(defaultIfEmpty(0), map((value) => value));
export const sort = VirtualTimeScheduler.sortActions;
export const scheduler = new VirtualTimeScheduler();
export type Legacy = Observable<number>;
