// Angular APIs deprecated with an announced removal major. Written by hand from the official
// sources cited on every entry; each source was read on the retrieval date below. A deprecation
// counts only when its source names the Angular major of the removal: deprecations without one,
// announced removals that passed without the removal, and usages a source scan cannot find are
// listed in DEPRECATED_API_EXCLUDED with the reason. The plan shows each finding as a warning in
// the hop to the major before the removal. Text is plain ASCII.
import type { DeprecatedApiData, DeprecatedApiEntry, DeprecatedApiExclusion, RemovedApiAudit, RemovedApiSource } from './types.js';

const RETRIEVED = '2026-10-03';

/** Every entry was written from its source after the removed-API audit, so none was re-read separately. */
function added(note: string): RemovedApiAudit {
  return { status: 'added', read: RETRIEVED, note };
}

/** Release tag of the Angular sources read for the deprecation notices. */
const ANGULAR_TAG = 'v22.2.1';
const ANGULAR_COMMIT = 'c0dc8c4bbeea70879aef54e9fcc7888359dfd1a5';

/** A `@deprecated` notice in the Angular sources at ANGULAR_TAG; the line holds the notice. */
function notice(file: string, line: number, title: string): RemovedApiSource {
  return { url: `https://github.com/angular/angular/blob/${ANGULAR_TAG}/packages/${file}#L${line}`, title };
}

const ANIMATIONS_GUIDE: RemovedApiSource = {
  url: 'https://angular.dev/guide/animations/migration',
  title: 'Migrating away from Angular\'s Animations package',
};

const ANIMATIONS_NOTE = 'The notice reads "@deprecated 20.2 Use `animate.enter` or `animate.leave` instead. Intent to remove in v23".';

const ANIMATIONS_REPLACEMENT = 'animate.enter and animate.leave with native CSS animations (see the animations migration guide)';

/** Shared fields of the entries for the @angular/animations deprecation of 20.2. */
const ANIMATIONS = {
  kind: 'symbol',
  deprecatedIn: 20,
  removalMajor: 23,
  replacement: ANIMATIONS_REPLACEMENT,
  references: [ANIMATIONS_GUIDE],
  audit: added(`Written from the deprecation notice. ${ANIMATIONS_NOTE}`),
} as const;

const ENTRIES: readonly DeprecatedApiEntry[] = [
  {
    ...ANIMATIONS,
    id: 'd23-animations-package',
    package: '@angular/animations',
    symbol: '*',
    label: '@angular/animations',
    summary: 'Every public API of @angular/animations (trigger, state, style, animate, AnimationBuilder and the rest) is deprecated since 20.2.',
    source: notice('animations/src/animation_metadata.ts', 650, '@angular/animations trigger(), deprecation notice'),
    references: [
      notice('animations/src/animation_builder.ts', 73, '@angular/animations AnimationBuilder, deprecation notice'),
      ANIMATIONS_GUIDE,
    ],
  },
  {
    ...ANIMATIONS,
    id: 'd23-animations-browser',
    package: '@angular/animations/browser',
    symbol: '*',
    label: '@angular/animations/browser',
    summary: 'AnimationDriver and NoopAnimationDriver, the public API of @angular/animations/browser, are deprecated since 20.2.',
    source: notice('animations/browser/src/render/animation_driver.ts', 78, '@angular/animations/browser AnimationDriver, deprecation notice'),
    references: [
      notice('animations/browser/src/render/animation_driver.ts', 16, '@angular/animations/browser NoopAnimationDriver, deprecation notice'),
      ANIMATIONS_GUIDE,
    ],
  },
  {
    ...ANIMATIONS,
    id: 'd23-animations-browser-testing',
    package: '@angular/animations/browser/testing',
    symbol: '*',
    label: '@angular/animations/browser/testing',
    summary: 'MockAnimationDriver and MockAnimationPlayer, the public API of @angular/animations/browser/testing, are deprecated since 20.2.',
    source: notice(
      'animations/browser/testing/src/mock_animation_driver.ts',
      29,
      '@angular/animations/browser/testing MockAnimationDriver, deprecation notice',
    ),
    references: [
      notice(
        'animations/browser/testing/src/mock_animation_driver.ts',
        83,
        '@angular/animations/browser/testing MockAnimationPlayer, deprecation notice',
      ),
      ANIMATIONS_GUIDE,
    ],
  },
  {
    ...ANIMATIONS,
    id: 'd23-platform-browser-animations-module',
    package: '@angular/platform-browser/animations',
    symbol: 'BrowserAnimationsModule',
    label: 'BrowserAnimationsModule',
    summary: 'BrowserAnimationsModule, which enables @angular/animations, is deprecated since 20.2.',
    replacement: 'remove it once no component uses @angular/animations; animate.enter and animate.leave need no provider',
    source: notice('platform-browser/animations/src/module.ts', 38, '@angular/platform-browser/animations BrowserAnimationsModule, deprecation notice'),
  },
  {
    ...ANIMATIONS,
    id: 'd23-platform-browser-animations-module-config',
    package: '@angular/platform-browser/animations',
    symbol: 'BrowserAnimationsModuleConfig',
    label: 'BrowserAnimationsModuleConfig',
    summary: 'BrowserAnimationsModuleConfig, the options of BrowserAnimationsModule.withConfig, is deprecated since 20.2.',
    replacement: 'remove it together with BrowserAnimationsModule',
    source: notice(
      'platform-browser/animations/src/module.ts',
      23,
      '@angular/platform-browser/animations BrowserAnimationsModuleConfig, deprecation notice',
    ),
  },
  {
    ...ANIMATIONS,
    id: 'd23-platform-browser-provide-animations',
    package: '@angular/platform-browser/animations',
    symbol: 'provideAnimations',
    label: 'provideAnimations()',
    summary: 'provideAnimations(), which enables @angular/animations, is deprecated since 20.2.',
    replacement: 'remove it once no component uses @angular/animations; animate.enter and animate.leave need no provider',
    source: notice('platform-browser/animations/src/module.ts', 95, '@angular/platform-browser/animations provideAnimations, deprecation notice'),
  },
  {
    ...ANIMATIONS,
    id: 'd23-platform-browser-noop-animations-module',
    package: '@angular/platform-browser/animations',
    symbol: 'NoopAnimationsModule',
    label: 'NoopAnimationsModule',
    summary: 'NoopAnimationsModule, which turns @angular/animations off, is deprecated since 20.2.',
    replacement: 'remove it once no component uses @angular/animations',
    source: notice('platform-browser/animations/src/module.ts', 109, '@angular/platform-browser/animations NoopAnimationsModule, deprecation notice'),
  },
  {
    ...ANIMATIONS,
    id: 'd23-platform-browser-provide-noop-animations',
    package: '@angular/platform-browser/animations',
    symbol: 'provideNoopAnimations',
    label: 'provideNoopAnimations()',
    summary: 'provideNoopAnimations(), which turns @angular/animations off, is deprecated since 20.2.',
    replacement: 'remove it once no component uses @angular/animations',
    source: notice(
      'platform-browser/animations/src/module.ts',
      138,
      '@angular/platform-browser/animations provideNoopAnimations, deprecation notice',
    ),
  },
  {
    ...ANIMATIONS,
    id: 'd23-platform-browser-provide-animations-async',
    package: '@angular/platform-browser/animations/async',
    symbol: 'provideAnimationsAsync',
    label: 'provideAnimationsAsync()',
    summary: 'provideAnimationsAsync(), which loads @angular/animations lazily, is deprecated since 20.2.',
    replacement: 'remove it once no component uses @angular/animations; animate.enter and animate.leave need no provider',
    source: notice(
      'platform-browser/animations/async/src/providers.ts',
      50,
      '@angular/platform-browser/animations/async provideAnimationsAsync, deprecation notice',
    ),
  },
  {
    ...ANIMATIONS,
    id: 'd23-core-component-animations',
    package: '@angular/core',
    symbol: 'Component',
    key: 'animations',
    label: '@Component animations',
    summary: 'The animations property of Component metadata, which holds @angular/animations triggers, is deprecated since 20.2.',
    source: notice('core/src/metadata/directives.ts', 601, '@angular/core Component.animations, deprecation notice'),
  },
  {
    kind: 'symbol',
    id: 'd24-platform-browser-with-incremental-hydration',
    package: '@angular/platform-browser',
    symbol: 'withIncrementalHydration',
    label: 'withIncrementalHydration()',
    deprecatedIn: 22,
    removalMajor: 24,
    summary: 'withIncrementalHydration() is deprecated since 22.0 because provideClientHydration enables incremental hydration by default.',
    replacement: 'remove it; provideClientHydration() enables incremental hydration by default (withNoIncrementalHydration() turns it off)',
    source: notice('platform-browser/src/hydration.ts', 146, '@angular/platform-browser withIncrementalHydration, deprecation notice'),
    audit: added(
      'Written from the deprecation notice, which reads "@deprecated Since v22.0.0, incremental hydration is enabled by default with `provideClientHydration`. Intent to remove in v24."',
    ),
  },
];

export const DEPRECATED_APIS: DeprecatedApiData = { retrieved: RETRIEVED, entries: ENTRIES };

/** The removal majors a deprecated-API dataset announces, ascending, and its retrieval date. */
export function deprecationCoverage(data: DeprecatedApiData): { removalMajors: number[]; retrieved: string } {
  const majors = [...new Set(data.entries.map((entry) => entry.removalMajor))].sort((a, b) => a - b);
  return { removalMajors: majors, retrieved: data.retrieved };
}

/** The Angular CHANGELOG at the commit the removed-API data cites. */
function changelog(anchor: string, title: string): RemovedApiSource {
  return { url: `https://github.com/angular/angular/blob/${ANGULAR_COMMIT}/CHANGELOG.md#${anchor}`, title };
}

/** Deprecated APIs that were considered and are not entries, with the reason. */
export const DEPRECATED_API_EXCLUDED: readonly DeprecatedApiExclusion[] = [
  {
    package: '@angular/core',
    candidate: 'APP_INITIALIZER, ENVIRONMENT_INITIALIZER and PLATFORM_INITIALIZER',
    deprecatedIn: 19,
    category: 'no-removal-major',
    reason: 'Deprecated from 19.0.0 in favour of provideAppInitializer, provideEnvironmentInitializer and providePlatformInitializer; the notices name no removal major.',
    source: notice('core/src/application/application_init.ts', 38, '@angular/core APP_INITIALIZER, deprecation notice'),
  },
  {
    package: '@angular/common',
    candidate: 'NgIf, NgFor and NgSwitch',
    deprecatedIn: 20,
    category: 'no-removal-major',
    reason: 'Deprecated in 20.0 in favour of the @if, @for and @switch blocks; no source names a removal major.',
    source: changelog('2000-2025-05-28', 'Angular CHANGELOG, 20.0.0 deprecations'),
  },
  {
    package: '@angular/platform-browser',
    candidate: 'HammerJS support (HammerModule, HAMMER_GESTURE_CONFIG, HammerGestureConfig)',
    deprecatedIn: 20,
    category: 'no-removal-major',
    reason: 'The CHANGELOG says it "will be removed in a future major version" without naming one.',
    source: changelog('2000-2025-05-28', 'Angular CHANGELOG, 20.0.0 deprecations'),
  },
  {
    package: '@angular/platform-browser-dynamic',
    candidate: 'Every entry of @angular/platform-browser-dynamic',
    deprecatedIn: 20,
    category: 'no-removal-major',
    reason: 'Deprecated in favour of @angular/platform-browser; no source names a removal major.',
    source: changelog('2000-2025-05-28', 'Angular CHANGELOG, 20.0.0 deprecations'),
  },
  {
    package: '@angular/common/http',
    candidate: 'XHR backend during server-side rendering (withXhr on the server, ServerXhr)',
    deprecatedIn: 22,
    category: 'not-detectable',
    reason: 'Removal is intended in Angular 23, but only for requests made on the server: withXhr() and HttpXhrBackend stay supported in the browser, a source scan cannot tell which platform a provider runs on, and ServerXhr is not exported.',
    source: notice('platform-server/src/http.ts', 24, '@angular/platform-server ServerXhr, deprecation notice'),
  },
  {
    package: '@angular/core',
    candidate: '@Component and @Directive moduleId',
    deprecatedIn: 16,
    category: 'removal-passed',
    reason: 'The 16.0.0 CHANGELOG announced the removal for 17, but moduleId stayed until 21; the removal is the removed-API entry v21-core-component-module-id.',
    source: changelog('1600-2023-05-03', 'Angular CHANGELOG, 16.0.0 deprecations'),
  },
  {
    package: '@angular/platform-browser',
    candidate: 'DomAdapter members marked "To be removed in version 14"',
    deprecatedIn: null,
    category: 'internal-api',
    reason: 'BrowserDomAdapter and DominoAdapter are private (exported only with the theta prefix), and the announced major passed.',
    source: notice('platform-browser/src/browser/browser_adapter.ts', 59, '@angular/platform-browser BrowserDomAdapter, deprecation notice'),
  },
  {
    package: '@angular/core',
    candidate: 'Animation trigger bindings in templates ([@trigger], (@trigger.done))',
    deprecatedIn: 20,
    category: 'not-detectable',
    reason: 'Not a separate entry: a template trigger needs a trigger() from @angular/animations in the component, which the d23-animations-package entry finds by import; a text pattern would only repeat it with less certainty.',
    source: notice('core/src/metadata/directives.ts', 601, '@angular/core Component.animations, deprecation notice'),
  },
];
