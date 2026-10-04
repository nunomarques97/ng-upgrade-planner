import { Injectable } from '@angular/core';
import { iif as when, of } from 'rxjs';
import * as ops from 'rxjs/operators';
import * as rx from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FlagService {
  readonly one$ = when(() => true, of(1));
  readonly two$ = rx.iif(() => false, of(2));
  readonly three$ = of(3).pipe(ops.defaultIfEmpty());
  readonly sort = rx.VirtualTimeScheduler.sortActions;
  readonly spread$ = when(...([() => true, of(4)] as const));
}

export * from 'rxjs/Rx';
