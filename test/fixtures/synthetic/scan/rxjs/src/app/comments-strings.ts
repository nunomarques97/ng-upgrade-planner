import { of } from 'rxjs';

// import { Observable } from 'rxjs/Rx';
/* iif(() => true, of(1)) and defaultIfEmpty() with VirtualTimeScheduler.sortActions */
export const hint = "import { iif } from 'rxjs'; iif(() => true)";
export const template = `defaultIfEmpty() from 'rxjs/operators'`;
export const value$ = of('rxjs/Rx');
