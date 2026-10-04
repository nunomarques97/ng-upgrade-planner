// RxJS 6 to 7 breaking changes that an import-aware scan of TypeScript sources can find. Written by
// hand from the official RxJS breaking-changes document and CHANGELOG, read at a pinned commit on the
// retrieval date below; the typings of the published rxjs 6.6.7 and 7.0.0 packages were compared to
// confirm each entry. Breaking changes a source scan cannot find, or that are not source usages, are
// listed in RXJS_API_EXCLUDED with the reason. The plan shows the findings only when the installed
// rxjs is 6.x, and ties them to the hop whose @angular/core peer range accepts no RxJS 6. Text is
// plain ASCII.
import type { RemovedApiAudit, RxjsApiData, RxjsApiEntry, RxjsApiExclusion, RxjsApiSource } from './types.js';

const RETRIEVED = '2026-10-03';

/** Head of the ReactiveX/rxjs 7.x branch when the sources were read (2025-02-22, release 7.8.2). */
const RXJS_COMMIT = 'e5351d02e225e275ac0e497c7b66eaa5f0c88791';

/** Every entry was written from its source after the removed-API audit, so none was re-read separately. */
function added(note: string): RemovedApiAudit {
  return { status: 'added', read: RETRIEVED, note };
}

/** A line of the "Breaking Changes in Version 7" document at RXJS_COMMIT. */
function breaking(line: number, title: string): RxjsApiSource {
  return {
    url: `https://github.com/ReactiveX/rxjs/blob/${RXJS_COMMIT}/docs_app/content/deprecations/breaking-changes.md?plain=1#L${line}`,
    title,
  };
}

/** A line of the RxJS CHANGELOG at RXJS_COMMIT. */
function changelog(line: number, title: string): RxjsApiSource {
  return { url: `https://github.com/ReactiveX/rxjs/blob/${RXJS_COMMIT}/CHANGELOG.md?plain=1#L${line}`, title };
}

const ENTRIES: readonly RxjsApiEntry[] = [
  {
    kind: 'symbol',
    id: 'rx7-rx-import',
    package: 'rxjs/Rx',
    symbol: '*',
    label: 'rxjs/Rx',
    change: 'removed',
    rxjsMajor: 7,
    summary: 'rxjs/Rx is no longer a valid import site, and rxjs-compat, which provided it in RxJS 6, is not published for RxJS 7.',
    replacement: "creation functions and types from 'rxjs', pipeable operators from 'rxjs/operators'",
    source: breaking(36, 'RxJS breaking changes in version 7, rxjs-compat: rxjs/Rx'),
    references: [
      breaking(7, 'RxJS breaking changes in version 7, rxjs-compat is not published'),
      changelog(702, 'RxJS CHANGELOG, 7.0.0-alpha.0 breaking changes: rxjs/Rx'),
    ],
    audit: added('Written from the breaking-changes document; in the rxjs 6.6.7 package, rxjs/Rx only re-exports rxjs-compat.'),
  },
  {
    kind: 'symbol',
    id: 'rx7-virtual-time-scheduler-sort-actions',
    package: 'rxjs',
    symbol: 'VirtualTimeScheduler',
    member: 'sortActions',
    label: 'VirtualTimeScheduler.sortActions',
    change: 'removed',
    rxjsMajor: 7,
    summary: 'The static sortActions method of VirtualTimeScheduler is no longer exposed by the RxJS typings.',
    replacement: 'none',
    noReplacementReason: 'It was an implementation detail of the scheduler; the sources give no public equivalent.',
    source: breaking(25, 'RxJS breaking changes in version 7, VirtualTimeScheduler.sortActions'),
    references: [changelog(522, 'RxJS CHANGELOG, 7.0.0-beta.5 breaking changes')],
    audit: added('Written from the breaking-changes document; sortActions is a public static in the 6.6.7 typings and private in 7.0.0.'),
  },
  {
    kind: 'symbol',
    id: 'rx7-default-if-empty-no-value',
    package: 'rxjs/operators',
    symbol: 'defaultIfEmpty',
    minArguments: 1,
    label: 'defaultIfEmpty() without a value',
    change: 'breaking',
    rxjsMajor: 7,
    summary: 'defaultIfEmpty requires a value and no longer turns a missing value into null.',
    replacement: 'pass the default value explicitly, for example defaultIfEmpty(null)',
    source: changelog(273, 'RxJS CHANGELOG, 7.0.0-beta.13 breaking changes: defaultIfEmpty'),
    audit: added('Written from the CHANGELOG; the value is optional in the 6.6.7 typings and required in 7.0.0.'),
  },
  {
    kind: 'symbol',
    id: 'rx7-iif-missing-result',
    package: 'rxjs',
    symbol: 'iif',
    minArguments: 3,
    label: 'iif() without both results',
    change: 'breaking',
    rxjsMajor: 7,
    summary: 'iif no longer allows undefined result arguments, so both the true and the false result must be passed.',
    replacement: 'pass EMPTY for a result that should emit nothing, for example iif(condition, source$, EMPTY)',
    source: changelog(382, 'RxJS CHANGELOG, 7.0.0-beta.9 breaking changes: iif'),
    audit: added('Written from the CHANGELOG; both results are optional in the 6.6.7 typings and required in 7.0.0.'),
  },
];

export const RXJS_APIS: RxjsApiData = { retrieved: RETRIEVED, rxjsMajor: 7, entries: ENTRIES };

/** RxJS 7 breaking changes that were considered and are not entries, with the reason. */
export const RXJS_API_EXCLUDED: readonly RxjsApiExclusion[] = [
  {
    package: 'rxjs',
    candidate: 'Observable.toPromise() resolving to T | undefined',
    category: 'not-detectable',
    reason: 'toPromise is called on an Observable instance, not on an import, and only code that relies on the old return type breaks.',
    source: breaking(9, 'RxJS breaking changes in version 7, toPromise'),
  },
  {
    package: 'rxjs',
    candidate: 'Subscription.add() no longer returning a Subscription',
    category: 'not-detectable',
    reason: 'add is called on a Subscription instance; only a use of its return value breaks, which needs types to find.',
    source: breaking(11, 'RxJS breaking changes in version 7, Subscription.add'),
  },
  {
    package: 'rxjs',
    candidate: 'Observable.lift no longer exposed',
    category: 'not-detectable',
    reason: 'lift is read on an Observable instance or on this inside a subclass, which an import does not identify.',
    source: breaking(13, 'RxJS breaking changes in version 7, Observable.lift'),
  },
  {
    package: 'rxjs',
    candidate: 'new Subscriber with 0 to 3 function arguments',
    category: 'not-detectable',
    reason: 'new Subscriber(observer) still works; telling it apart from the removed function arguments needs the argument types.',
    source: breaking(15, 'RxJS breaking changes in version 7, Subscriber'),
  },
  {
    package: 'rxjs',
    candidate: 'onUnhandledError, Error stack properties, unsubscribe through this, Notification.createNext(undefined)',
    category: 'not-detectable',
    reason: 'Runtime behaviour changes with no import or call shape of their own.',
    source: breaking(17, 'RxJS breaking changes in version 7, onUnhandledError'),
  },
  {
    package: 'rxjs',
    candidate: 'Subscriber._unsubscribeAndRecycle',
    category: 'not-detectable',
    reason: 'A method of Subscriber instances, usually in subclasses, which an import does not identify.',
    source: breaking(23, 'RxJS breaking changes in version 7, _unsubscribeAndRecycle'),
  },
  {
    package: 'rxjs',
    candidate: 'Tighter Notification and dematerialize types, experimental for await support, ReplaySubject with a scheduler',
    category: 'not-detectable',
    reason: 'The type changes need a type checker; for await works on any value; a ReplaySubject scheduler is created with new, which the scan does not match, and keeps working without scheduling.',
    source: breaking(29, 'RxJS breaking changes in version 7, Notification and dematerialize'),
  },
  {
    package: 'rxjs',
    candidate: 'Explicit type arguments on concat and of',
    category: 'not-detectable',
    reason: 'Whether a call with type arguments still compiles depends on the number of arguments and on the 7.x release (later 7.x typings accept of<T>(value) again).',
    source: breaking(42, 'RxJS breaking changes in version 7, concat and of generics'),
  },
  {
    package: 'rxjs/operators',
    candidate: 'Operator behaviour changes: count, defer, map thisArg, mergeScan, pairs, race, single, skipLast, startWith, throwError, timestamp, zip, buffer, window, audit, debounce, delayWhen, sample, throttle',
    category: 'not-detectable',
    reason: 'The call shape stays valid; only the values emitted, the timing or the errors change, which needs runtime tests to find.',
    source: changelog(361, 'RxJS CHANGELOG, 7.0.0-beta.9 breaking changes'),
  },
  {
    package: 'rxjs/operators',
    candidate: 'retry and repeat with a negative count',
    category: 'not-detectable',
    reason: 'Only a literal negative count could be found, while counts usually come from variables; the document calls the old behaviour undocumented.',
    source: breaking(79, 'RxJS breaking changes in version 7, retry'),
  },
  {
    package: 'rxjs/operators',
    candidate: 'take() and takeLast() without a count',
    category: 'already-broken',
    reason: 'The count is required in the rxjs 6.6.7 typings, so TypeScript code already cannot omit it; the runtime check affects plain JavaScript.',
    source: breaking(95, 'RxJS breaking changes in version 7, take'),
  },
  {
    package: 'rxjs/ajax',
    candidate: 'ajax body serialization, Content-Type handling, AjaxRequest in place of AjaxConfig, IE10 support',
    category: 'not-detectable',
    reason: 'Request behaviour changes; AjaxRequest stays compatible with AjaxConfig, so its use does not break the build.',
    source: breaking(119, 'RxJS breaking changes in version 7, ajax'),
  },
  {
    package: 'rxjs',
    candidate: 'TypeScript 4.2, @types/node 14.14.3 and symbol-observable 3.0.0 or later',
    category: 'outside-scope',
    reason: 'Toolchain and dependency requirements, not source usages; the per-hop TypeScript requirement covers the toolchain.',
    source: changelog(380, 'RxJS CHANGELOG, 7.0.0-beta.9 breaking changes: Symbol.observable'),
  },
  {
    package: 'rxjs',
    candidate: 'Deep rxjs-compat import paths (rxjs/Observable, rxjs/add/operator/*, rxjs/observable/*) and rxjs/internal-compatibility',
    category: 'no-official-source',
    reason: 'The documents name only rxjs/Rx and the end of rxjs-compat; the other paths are gone from the 7.0.0 package exports, but no official document lists them.',
    source: breaking(7, 'RxJS breaking changes in version 7, rxjs-compat is not published'),
  },
];
