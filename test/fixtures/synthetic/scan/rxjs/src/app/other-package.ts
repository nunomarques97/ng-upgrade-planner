import { iif, VirtualTimeScheduler } from 'other-streams';
import { defaultIfEmpty } from './local-operators';
import { of } from 'rxjs';

export const local$ = iif(() => true, of(1));
export const fallback = defaultIfEmpty();
export const sort = VirtualTimeScheduler.sortActions;

