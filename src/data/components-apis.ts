// Angular Material and Angular CDK APIs removed, or changed in a breaking way, in each major from
// 9 to 22. Written from the breaking changes of the angular/components CHANGELOG at a pinned commit;
// every symbol was checked in the public API golden of the last release that still exported it,
// which also names its entry point. Material and the CDK release with the same major as Angular, so
// each entry belongs to the hop of that Angular major. Candidates a source scan cannot find are in
// COMPONENTS_EXCLUDED with the reason. Spread into src/data/removed-apis.ts. Text is plain ASCII.
import type {
  RemovedApiAudit,
  RemovedApiEntry,
  RemovedApiExclusion,
  RemovedApiMigration,
  RemovedApiSource,
  RemovedSymbolEntry,
} from './types.js';

/** Date the sources below were read. */
const READ = '2026-10-03';

const COMPONENTS_COMMIT = 'f6c2a193ec4ad454beeafc74469103fecfc96a12';

const REPO = 'https://github.com/angular/components/blob';

/** Headings of the major releases in the CHANGELOG: codename and date. */
const RELEASES: Readonly<Record<number, readonly [string, string]>> = {
  9: ['tungsten-hombre', '2020-02-06'],
  10: ['ice-dice', '2020-06-24'],
  11: ['nitrite-trilobite', '2020-11-11'],
  12: ['azurite-insight', '2021-05-12'],
  13: ['fir-valise', '2021-11-03'],
  14: ['cotton-peanut', '2022-06-02'],
  15: ['diamond-dinosaur', '2022-11-16'],
  17: ['deferred-diamond', '2023-11-08'],
  18: ['satin-sasquatch', '2024-05-22'],
  19: ['hafnium-hippo', '2024-11-19'],
  20: ['calcium-carrot', '2025-05-28'],
  21: ['damask-dachshund', '2025-11-19'],
  22: ['aurostibite-ambulance', '2026-06-03'],
};

function added(note: string): RemovedApiAudit {
  return { status: 'added', read: READ, note };
}

/** Breaking changes of a major in the angular/components CHANGELOG (11 and older are archived). */
function changelog(major: number): RemovedApiSource {
  const release = RELEASES[major];
  if (release === undefined) throw new Error(`No release heading recorded for Angular components ${major}`);
  const file = major <= 11 ? 'CHANGELOG_ARCHIVE.md' : 'CHANGELOG.md';
  return {
    url: `${REPO}/${COMPONENTS_COMMIT}/${file}#${major}00-${release[0]}-${release[1]}`,
    title: `Angular components CHANGELOG, ${major}.0.0 breaking changes`,
  };
}

/** The 9.0.0-next.0 pre-release, where the removal of the @angular/material entry point is listed. */
const CHANGELOG_9_NEXT: RemovedApiSource = {
  url: `${REPO}/${COMPONENTS_COMMIT}/CHANGELOG_ARCHIVE.md#900-next0-cardboard-cpu-2019-10-03`,
  title: 'Angular components CHANGELOG, 9.0.0-next.0 breaking changes',
};

/** Release tags are written 9.0.0 to 21.0.2 and v21.1.0 onwards. */
function tagOf(version: string): string {
  const major = Number(version.split('.')[0]);
  return major >= 22 ? `v${version}` : version;
}

/** The public API golden of an entry point, such as material/core, at a release. */
function golden(version: string, entryPoint: string): RemovedApiSource {
  const major = Number(version.split('.')[0]);
  const path =
    major <= 11
      ? `tools/public_api_guard/${entryPoint}.d.ts`
      : major <= 18
        ? `tools/public_api_guard/${entryPoint}.md`
        : `goldens/${entryPoint}/index.api.md`;
  return { url: `${REPO}/${tagOf(version)}/${path}`, title: `@angular/${entryPoint} ${version} public API` };
}

type ComponentsPackage = 'material' | 'cdk';

/** The `ng update` migrations that @angular/material or @angular/cdk ships in a major. */
function migrations(pkg: ComponentsPackage, major: number): RemovedApiSource {
  return {
    url: `${REPO}/${tagOf(`${major}.0.0`)}/src/${pkg}/schematics/migration.json`,
    title: `@angular/${pkg} ${major}.0.0 ng update migrations`,
  };
}

/** A file of the ng update sources of @angular/material or @angular/cdk at a major release. */
function updateFile(pkg: ComponentsPackage, major: number, path: string, title: string): RemovedApiSource {
  return { url: `${REPO}/${tagOf(`${major}.0.0`)}/src/${pkg}/schematics/ng-update/${path}`, title };
}

/** Lowercase words joined by hyphens, for ids: MAT_FAB_DEFAULT_OPTIONS_FACTORY, matMenuAnimations. */
function kebab(name: string): string {
  return name
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

interface SymbolSpec {
  symbol: string;
  /** Last part of the id, when the one made from the symbol is taken by a class of the same words. */
  idSuffix?: string;
  member?: string;
  /** Defaults to the group's replacement. */
  replacement?: string;
  noReplacementReason?: string;
  summary?: string;
  /** Added to the audit note, for example where the CHANGELOG misspells the name. */
  note?: string;
}

interface GroupSpec {
  major: number;
  /** Entry point without @angular/, such as material/core or cdk/portal. */
  entryPoint: string;
  /** Last release whose public API golden exports the symbols. */
  before: string;
  replacement: string;
  noReplacementReason?: string;
  migration: RemovedApiMigration;
  migrationNote?: string;
  /** Upgrade data or migration code read for the migration value. */
  migrationReferences?: readonly RemovedApiSource[];
  symbols: readonly (string | SymbolSpec)[];
}

/** Migrations of 17 to 22 hold no upgrade rule at all, so ng update leaves every usage in place. */
function noRules(major: number): string {
  return `The upgrade data of migration-v${major} has no rule for any API, so ng update leaves the usage in place.`;
}

function symbolGroup(group: GroupSpec): RemovedSymbolEntry[] {
  const pkg = group.entryPoint.split('/')[0] as ComponentsPackage;
  return group.symbols.map((item): RemovedSymbolEntry => {
    const spec: SymbolSpec = typeof item === 'string' ? { symbol: item } : item;
    const label = spec.member === undefined ? spec.symbol : `${spec.symbol}.${spec.member}`;
    const replacement = spec.replacement ?? group.replacement;
    const reason = spec.replacement === undefined ? group.noReplacementReason : spec.noReplacementReason;
    const entry: RemovedSymbolEntry = {
      id: `v${group.major}-${kebab(group.entryPoint.replace(/\//g, '-'))}-${spec.idSuffix ?? kebab(spec.symbol)}${spec.member ? `-${kebab(spec.member)}` : ''}`,
      kind: 'symbol',
      package: `@angular/${group.entryPoint}`,
      symbol: spec.symbol,
      label,
      change: 'removed',
      major: group.major,
      summary: spec.summary ?? `${label} has been removed from @angular/${group.entryPoint}.`,
      replacement,
      migration: group.migration,
      source: changelog(group.major),
      references: [golden(group.before, group.entryPoint), ...(group.migrationReferences ?? [])],
      audit: added(
        `Written from the CHANGELOG; the export was checked in the ${group.before} public API golden.${spec.note ? ` ${spec.note}` : ''}`,
      ),
    };
    if (spec.member !== undefined) entry.member = spec.member;
    if (replacement === 'none') entry.noReplacementReason = reason ?? '';
    if (group.migration !== 'unknown') entry.migrationSource = migrations(pkg, group.major);
    if (group.migrationNote !== undefined) entry.migrationNote = group.migrationNote;
    return entry;
  });
}

/** Factories, providers and animation constants that 20.x marked "No longer used, will be removed". */
function unused21(entryPoint: string, symbols: readonly string[]): RemovedSymbolEntry[] {
  return symbolGroup({
    major: 21,
    entryPoint,
    before: '20.2.14',
    replacement: 'none',
    noReplacementReason: 'Deprecated in 20 as no longer used by the library; delete the reference.',
    migration: 'no',
    migrationNote: noRules(21),
    symbols,
  });
}

/** The legacy (pre-MDC) entry points of Material 15 and 16, removed in 17, with their replacement. */
const LEGACY_ENTRY_POINTS: readonly string[] = [
  'autocomplete',
  'button',
  'card',
  'checkbox',
  'chips',
  'core',
  'dialog',
  'form-field',
  'input',
  'list',
  'menu',
  'paginator',
  'progress-bar',
  'progress-spinner',
  'radio',
  'select',
  'slide-toggle',
  'slider',
  'snack-bar',
  'table',
  'tabs',
  'tooltip',
];

const LEGACY_SOURCE: RemovedApiSource = {
  url: `${REPO}/${COMPONENTS_COMMIT}/CHANGELOG.md#1700-deferred-diamond-2023-11-08`,
  title: 'Angular components CHANGELOG, 17.0.0 material "remove legacy components"',
};

const LEGACY_IMPORTS_ERROR = updateFile(
  'material',
  17,
  'migrations/legacy-imports-error.ts',
  '@angular/material 17.0.0 legacy imports check of ng update',
);

function legacyEntryPoints(): RemovedSymbolEntry[] {
  return LEGACY_ENTRY_POINTS.flatMap((name) =>
    ['', '/testing'].map((suffix): RemovedSymbolEntry => {
      const entryPoint = `material/legacy-${name}${suffix}`;
      return {
        id: `v17-${kebab(entryPoint.replace(/\//g, '-'))}`,
        kind: 'symbol',
        package: `@angular/${entryPoint}`,
        symbol: '*',
        label: `@angular/${entryPoint}`,
        change: 'removed',
        major: 17,
        summary: `The legacy (pre-MDC) entry point @angular/${entryPoint} has been removed.`,
        replacement: `@angular/material/${name}${suffix}`,
        migration: 'no',
        migrationSource: migrations('material', 17),
        migrationNote:
          'ng update reports the files that still import a legacy entry point, sets @angular/material back to ^16.2.0 and stops.',
        source: LEGACY_SOURCE,
        references: [golden('16.2.14', `material/legacy-${name}${suffix === '' ? '' : '-testing'}`), LEGACY_IMPORTS_ERROR],
        audit: added(
          'Written from the CHANGELOG; the entry point is in the 16.2.14 public API goldens and not in the 17.0.0 ones.',
        ),
      };
    }),
  );
}

const MONTHS: readonly string[] = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const COMPONENTS_REMOVED_APIS: readonly RemovedApiEntry[] = [
  // Angular components 9
  {
    id: 'v9-material-primary-entry-point',
    kind: 'symbol',
    package: '@angular/material',
    symbol: '*',
    label: '@angular/material primary entry point',
    change: 'removed',
    major: 9,
    summary: 'Components can no longer be imported through "@angular/material".',
    replacement: 'The secondary entry point of each symbol, such as @angular/material/button',
    migration: 'unknown',
    migrationNote:
      'migration-v9 rewrites named imports to the secondary entry points and only reports namespace and side-effect imports.',
    source: CHANGELOG_9_NEXT,
    references: [
      updateFile(
        'material',
        9,
        'upgrade-rules/package-imports-v8/secondary-entry-points-rule.ts',
        '@angular/material 9.0.0 secondary entry points rule of ng update',
      ),
    ],
    audit: added('Written from the CHANGELOG and the rule that migration-v9 runs.'),
  },

  // Angular components 10
  ...symbolGroup({
    major: 10,
    entryPoint: 'material/core',
    before: '9.2.4',
    replacement: 'none',
    noReplacementReason:
      'Material no longer uses HammerJS and the CHANGELOG names no replacement; delete the reference, or configure gestures with HammerModule from @angular/platform-browser.',
    migration: 'unknown',
    migrationNote:
      'migration-v10 runs the hammer-gestures migration, which edits HammerJS setup; whether it removes every import of this symbol was not established.',
    migrationReferences: [
      updateFile(
        'material',
        10,
        'migrations/hammer-gestures-v9/hammer-gestures-migration.ts',
        '@angular/material 10.0.0 hammer-gestures migration',
      ),
    ],
    symbols: [
      'MAT_HAMMER_OPTIONS',
      'GestureConfig',
      'HammerInput',
      'HammerStatic',
      'Recognizer',
      'RecognizerStatic',
      'HammerInstance',
      'HammerManager',
      'HammerOptions',
    ],
  }),
  ...symbolGroup({
    major: 10,
    entryPoint: 'material/button-toggle',
    before: '9.2.4',
    replacement: 'MatButtonToggleGroup',
    migration: 'yes',
    migrationNote: 'The class-names upgrade data of migration-v10 replaces it with MatButtonToggleGroup.',
    migrationReferences: [updateFile('material', 10, 'data/class-names.ts', '@angular/material 10.0.0 class-names upgrade data')],
    symbols: ['MatButtonToggleGroupMultiple'],
  }),
  ...symbolGroup({
    major: 10,
    entryPoint: 'cdk/drag-drop',
    before: '9.2.4',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; the factory was no longer used. Delete the reference.',
    migration: 'no',
    migrationNote: 'No upgrade rule of migration-v10 names it.',
    symbols: ['CDK_DRAG_CONFIG_FACTORY'],
  }),
  {
    id: 'v10-cdk-clipboard-copied-output',
    kind: 'template',
    package: '@angular/cdk/clipboard',
    pattern: '\\(copied\\)(?=[^<>]*\\bcdkCopyToClipboard\\b)|\\(copied\\)(?<=\\bcdkCopyToClipboard\\b[^<>]*\\(copied\\))',
    label: '(copied) output of cdkCopyToClipboard',
    change: 'breaking',
    major: 10,
    summary: 'The copied event of cdkCopyToClipboard has been renamed to cdkCopyToClipboardCopied.',
    replacement: '(cdkCopyToClipboardCopied)',
    migration: 'yes',
    migrationSource: migrations('cdk', 10),
    migrationNote: 'The output-names upgrade data of migration-v10 renames it on elements with cdkCopyToClipboard.',
    source: changelog(10),
    references: [updateFile('cdk', 10, 'data/output-names.ts', '@angular/cdk 10.0.0 output-names upgrade data')],
    audit: added('Written from the CHANGELOG and the upgrade data; matches only on an element that has cdkCopyToClipboard.'),
  },

  // Angular components 11
  ...symbolGroup({
    major: 11,
    entryPoint: 'material/core',
    before: '10.2.7',
    replacement: 'A number literal (JAN is 0, DEC is 11)',
    migration: 'no',
    migrationNote: 'No upgrade rule of migration-v11 names it.',
    symbols: MONTHS.map((month) => ({
      symbol: month,
      summary: `The month constant ${month} has been removed from @angular/material/core; it was only meant for tests.`,
    })),
  }),

  // Angular components 13
  ...symbolGroup({
    major: 13,
    entryPoint: 'cdk/clipboard',
    before: '12.2.13',
    replacement: 'CDK_COPY_TO_CLIPBOARD_CONFIG',
    migration: 'no',
    migrationNote: 'No upgrade rule of migration-v13 renames it.',
    symbols: ['CKD_COPY_TO_CLIPBOARD_CONFIG'],
  }),
  ...symbolGroup({
    major: 13,
    entryPoint: 'cdk/overlay',
    before: '12.2.13',
    replacement: 'FlexibleConnectedPositionStrategy',
    migration: 'no',
    migrationNote: 'The constructor-checks upgrade data of migration-v13 only reports constructor calls; nothing is rewritten.',
    migrationReferences: [updateFile('cdk', 13, 'data/constructor-checks.ts', '@angular/cdk 13.0.0 constructor-checks upgrade data')],
    symbols: ['ConnectedPositionStrategy'],
  }),
  ...symbolGroup({
    major: 13,
    entryPoint: 'material/core',
    before: '12.2.13',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG says it is no longer necessary; delete the type annotation.',
    migration: 'no',
    migrationNote: 'The symbol-removal upgrade data of migration-v13 lists it; the migration only reports the import.',
    migrationReferences: [updateFile('material', 13, 'data/symbol-removal.ts', '@angular/material 13.0.0 symbol-removal upgrade data')],
    symbols: ['CanColorCtor', 'CanDisableRippleCtor', 'CanDisableCtor', 'CanUpdateErrorStateCtor', 'HasInitializedCtor', 'HasTabIndexCtor'],
  }),
  ...symbolGroup({
    major: 13,
    entryPoint: 'material/input',
    before: '12.2.13',
    replacement: 'CdkTextareaAutosize from @angular/cdk/text-field',
    migration: 'no',
    migrationNote: 'No upgrade rule of migration-v13 names it.',
    symbols: ['MatTextareaAutosize'],
  }),
  {
    id: 'v13-material-input-textarea-autosize-template',
    kind: 'template',
    package: '@angular/material/input',
    pattern: '(?<![\\w-])(?:matTextareaAutosize|mat-autosize|matAutosizeMinRows|matAutosizeMaxRows)(?![\\w-])',
    label: 'matTextareaAutosize directive in templates',
    change: 'removed',
    major: 13,
    summary: 'matTextareaAutosize (selector matTextareaAutosize or mat-autosize, inputs matAutosizeMinRows and matAutosizeMaxRows) has been removed.',
    replacement: 'cdkTextareaAutosize with cdkAutosizeMinRows and cdkAutosizeMaxRows from @angular/cdk/text-field',
    migration: 'no',
    migrationSource: migrations('material', 13),
    migrationNote: 'No upgrade rule of migration-v13 names it.',
    source: changelog(13),
    references: [golden('12.2.13', 'material/input')],
    audit: added('Written from the CHANGELOG; the selector and input names were read in the 12.2.13 public API golden.'),
  },

  // Angular components 14
  ...symbolGroup({
    major: 14,
    entryPoint: 'material/stepper',
    before: '13.3.9',
    replacement: 'MatStepper',
    migration: 'no',
    migrationNote: 'The constructor-checks upgrade data of migration-v14 only reports constructor calls; nothing is rewritten.',
    migrationReferences: [
      updateFile('material', 14, 'data/constructor-checks.ts', '@angular/material 14.0.0 constructor-checks upgrade data'),
    ],
    symbols: ['MatVerticalStepper', 'MatHorizontalStepper'],
  }),

  // Angular components 17
  ...legacyEntryPoints(),

  // Angular components 19
  ...symbolGroup({
    major: 19,
    entryPoint: 'material/core',
    before: '18.2.14',
    replacement: 'none',
    migration: 'no',
    migrationNote: noRules(19),
    symbols: [
      { symbol: 'mixinColor', replacement: 'A host binding' },
      { symbol: 'CanColor', replacement: 'A host binding' },
      { symbol: 'mixinDisableRipple', replacement: 'An input with a transform' },
      { symbol: 'CanDisableRipple', replacement: 'An input with a transform' },
      { symbol: 'mixinDisabled', replacement: 'An input with a transform' },
      { symbol: 'CanDisable', replacement: 'An input with a transform' },
      { symbol: 'mixinInitialized', replacement: 'A Subject that emits in ngOnInit' },
      { symbol: 'HasInitialized', replacement: 'A Subject that emits in ngOnInit' },
      { symbol: 'mixinTabIndex', replacement: 'An input with a transform' },
      { symbol: 'HasTabIndex', replacement: 'An input with a transform' },
    ],
  }),

  // Angular components 20
  ...symbolGroup({
    major: 20,
    entryPoint: 'cdk/dialog',
    before: '19.2.19',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; the DIALOG_SCROLL_STRATEGY token remains. Delete the reference.',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: ['DIALOG_SCROLL_STRATEGY_PROVIDER', 'DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY'],
  }),
  ...symbolGroup({
    major: 20,
    entryPoint: 'cdk/portal',
    before: '19.2.19',
    replacement: 'none',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: [
      { symbol: 'DomPortalHost', replacement: 'DomPortalOutlet' },
      { symbol: 'PortalInjector', replacement: 'Injector.create' },
      { symbol: 'PortalHost', replacement: 'PortalOutlet' },
      { symbol: 'BasePortalHost', replacement: 'BasePortalOutlet' },
    ],
  }),
  ...symbolGroup({
    major: 20,
    entryPoint: 'cdk/table',
    before: '19.2.19',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; it was part of the removed sticky mixin. Delete the reference.',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: [
      'Constructor',
      'CanStickCtor',
      { symbol: 'mixinHasStickyInput', replacement: 'Implement the CanStick interface' },
      'CanStick',
      'CDK_TABLE_TEMPLATE',
      'StickyDirection',
      'StickyStyler',
    ],
  }),
  ...symbolGroup({
    major: 20,
    entryPoint: 'material/checkbox',
    before: '19.2.19',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; the checkbox provides its own validator and value accessor. Delete the reference.',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: [
      { symbol: 'MAT_CHECKBOX_REQUIRED_VALIDATOR', idSuffix: 'mat-checkbox-required-validator-provider' },
      {
        symbol: 'MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR',
        note: 'The CHANGELOG writes MAT_CHECKBOX_VALUE_ACCESSOR; the export of that name in 19.2.19 is MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR, absent in 20.2.14.',
      },
      'MatCheckboxRequiredValidator',
      '_MatCheckboxRequiredValidatorModule',
    ],
  }),
  ...symbolGroup({
    major: 20,
    entryPoint: 'material/dialog',
    before: '19.2.19',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; the MAT_DIALOG_SCROLL_STRATEGY token remains. Delete the reference.',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: ['MAT_DIALOG_SCROLL_STRATEGY_PROVIDER', 'MAT_DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY'],
  }),
  ...symbolGroup({
    major: 20,
    entryPoint: 'material/select',
    before: '19.2.19',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; delete the reference.',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: [{ symbol: 'matSelectAnimations', member: 'transformPanelWrap' }],
  }),
  ...symbolGroup({
    major: 20,
    entryPoint: 'material/slide-toggle',
    before: '19.2.19',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; the slide toggle provides its own validator and value accessor. Delete the reference.',
    migration: 'no',
    migrationNote: noRules(20),
    symbols: [
      { symbol: 'MAT_SLIDE_TOGGLE_REQUIRED_VALIDATOR', idSuffix: 'mat-slide-toggle-required-validator-provider' },
      'MAT_SLIDE_TOGGLE_VALUE_ACCESSOR',
      'MatSlideToggleRequiredValidator',
      '_MatSlideToggleRequiredValidatorModule',
    ],
  }),

  // Angular components 21
  ...unused21('cdk/a11y', ['LIVE_ANNOUNCER_ELEMENT_TOKEN_FACTORY', 'TREE_KEY_MANAGER_FACTORY', 'TREE_KEY_MANAGER_FACTORY_PROVIDER']),
  ...symbolGroup({
    major: 21,
    entryPoint: 'cdk/portal',
    before: '20.2.14',
    replacement: 'none',
    migration: 'no',
    migrationNote: noRules(21),
    symbols: [
      { symbol: 'TemplatePortalDirective', replacement: 'CdkPortal' },
      { symbol: 'PortalHostDirective', replacement: 'CdkPortalOutlet' },
    ],
  }),
  ...unused21('material/autocomplete', [
    'MAT_AUTOCOMPLETE_DEFAULT_OPTIONS_FACTORY',
    'MAT_AUTOCOMPLETE_SCROLL_STRATEGY_FACTORY',
    'MAT_AUTOCOMPLETE_SCROLL_STRATEGY_FACTORY_PROVIDER',
  ]),
  ...unused21('material/bottom-sheet', ['matBottomSheetAnimations']),
  ...unused21('material/button-toggle', ['MAT_BUTTON_TOGGLE_GROUP_DEFAULT_OPTIONS_FACTORY']),
  ...unused21('material/button', ['MAT_FAB_DEFAULT_OPTIONS_FACTORY']),
  ...unused21('material/checkbox', ['MAT_CHECKBOX_DEFAULT_OPTIONS_FACTORY']),
  ...symbolGroup({
    major: 21,
    entryPoint: 'material/core',
    before: '20.2.14',
    replacement: 'none',
    noReplacementReason: 'Deprecated in 20 as no longer used by the library; delete the reference.',
    migration: 'no',
    migrationNote: noRules(21),
    symbols: [
      'AnimationCurves',
      'AnimationDurations',
      {
        symbol: 'MAT_DATE_LOCALE_FACTORY',
        note: 'The CHANGELOG writes MAT_DATE_LOCAL_FACTORY; the export of that name in 20.2.14 is MAT_DATE_LOCALE_FACTORY.',
      },
      {
        symbol: 'MatCommonModule',
        replacement: 'none',
        noReplacementReason:
          'Deprecated in 20 as no longer used; remove it from imports. It only re-exported BidiModule, which @angular/cdk/bidi still provides.',
      },
      'GranularSanityChecks',
      'MATERIAL_SANITY_CHECKS',
      'SanityChecks',
    ],
  }),
  ...unused21('material/datepicker', [
    'matDatepickerAnimations',
    'MAT_DATEPICKER_SCROLL_STRATEGY_FACTORY',
    'MAT_DATEPICKER_SCROLL_STRATEGY_FACTORY_PROVIDER',
    'MAT_RANGE_DATE_SELECTION_MODEL_FACTORY',
    'MAT_RANGE_DATE_SELECTION_MODEL_PROVIDER',
    'MAT_SINGLE_DATE_SELECTION_MODEL_FACTORY',
    'MAT_SINGLE_DATE_SELECTION_MODEL_PROVIDER',
  ]),
  ...unused21('material/dialog', ['_defaultParams', 'matDialogAnimations']),
  ...unused21('material/expansion', ['EXPANSION_PANEL_ANIMATION_TIMING', 'matExpansionAnimations']),
  ...unused21('material/form-field', ['matFormFieldAnimations']),
  ...unused21('material/icon', ['ICON_REGISTRY_PROVIDER', 'ICON_REGISTRY_PROVIDER_FACTORY', 'MAT_ICON_LOCATION_FACTORY']),
  ...unused21('material/menu', ['fadeInItems', 'transformMenu', 'matMenuAnimations', 'MAT_MENU_SCROLL_STRATEGY_FACTORY_PROVIDER']),
  ...unused21('material/paginator', ['MAT_PAGINATOR_INTL_PROVIDER', 'MAT_PAGINATOR_INTL_PROVIDER_FACTORY']),
  ...unused21('material/progress-bar', ['MAT_PROGRESS_BAR_LOCATION_FACTORY']),
  ...unused21('material/progress-spinner', ['MAT_PROGRESS_SPINNER_DEFAULT_OPTIONS_FACTORY']),
  ...unused21('material/radio', ['MAT_RADIO_DEFAULT_OPTIONS_FACTORY']),
  ...unused21('material/select', [
    'matSelectAnimations',
    'MAT_SELECT_SCROLL_STRATEGY_PROVIDER',
    'MAT_SELECT_SCROLL_STRATEGY_PROVIDER_FACTORY',
  ]),
  ...unused21('material/sidenav', ['matDrawerAnimations', 'MAT_DRAWER_DEFAULT_AUTOSIZE_FACTORY']),
  ...unused21('material/snack-bar', ['matSnackBarAnimations', 'MAT_SNACK_BAR_DEFAULT_OPTIONS_FACTORY']),
  ...unused21('material/sort', ['matSortAnimations', 'MAT_SORT_HEADER_INTL_PROVIDER', 'MAT_SORT_HEADER_INTL_PROVIDER_FACTORY']),
  ...unused21('material/stepper', ['matStepperAnimations', 'MAT_STEPPER_INTL_PROVIDER', 'MAT_STEPPER_INTL_PROVIDER_FACTORY']),
  ...unused21('material/tabs', ['matTabsAnimations', '_MAT_INK_BAR_POSITIONER_FACTORY']),
  ...unused21('material/tooltip', [
    'matTooltipAnimations',
    'MAT_TOOLTIP_DEFAULT_OPTIONS_FACTORY',
    'MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY',
    'MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY_PROVIDER',
  ]),

  // Angular components 22
  ...symbolGroup({
    major: 22,
    entryPoint: 'cdk/a11y',
    before: '21.0.2',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; delete the reference.',
    migration: 'no',
    migrationNote: noRules(22),
    symbols: ['CDK_DESCRIBEDBY_HOST_ATTRIBUTE', 'CDK_DESCRIBEDBY_ID_PREFIX', 'MESSAGES_CONTAINER_ID'],
  }),
  ...symbolGroup({
    major: 22,
    entryPoint: 'cdk/menu',
    before: '21.0.2',
    replacement: 'MenuTracker',
    migration: 'no',
    migrationNote: noRules(22),
    symbols: [{ symbol: 'ContextMenuTracker', note: 'In 21.0.2 it is an alias export of MenuTracker.' }],
  }),
  ...symbolGroup({
    major: 22,
    entryPoint: 'material/list',
    before: '21.0.2',
    replacement: 'MatListOptionTogglePosition',
    migration: 'no',
    migrationNote: noRules(22),
    symbols: [{ symbol: 'MatListOptionCheckboxPosition', note: 'In 21.0.2 it is an alias export of MatListOptionTogglePosition.' }],
  }),
  {
    id: 'v22-material-list-checkbox-position-input',
    kind: 'template',
    package: '@angular/material/list',
    pattern: '(?<![\\w-])checkboxPosition(?![\\w-])(?<=<mat-list-option\\b[^<>]*checkboxPosition)',
    label: 'checkboxPosition input of mat-list-option',
    change: 'removed',
    major: 22,
    summary: 'MatListOption.checkboxPosition has been removed.',
    replacement: 'togglePosition',
    migration: 'no',
    migrationSource: migrations('material', 22),
    migrationNote: noRules(22),
    source: changelog(22),
    references: [golden('21.0.2', 'material/list')],
    audit: added('Written from the CHANGELOG; the input and the mat-list-option selector were read in the 21.0.2 public API golden.'),
  },
  ...symbolGroup({
    major: 22,
    entryPoint: 'material/sort',
    before: '21.0.2',
    replacement: 'none',
    noReplacementReason: 'The CHANGELOG names no replacement; delete the reference.',
    migration: 'no',
    migrationNote: noRules(22),
    symbols: ['ArrowViewState', 'ArrowViewStateTransition'],
  }),
];

const NOT_TYPED = 'The scan does not know the type of an expression, so a use of an instance member cannot be tied to an import.';

/** Candidates read in the angular/components CHANGELOG and left out, with the reason. */
export const COMPONENTS_EXCLUDED: readonly RemovedApiExclusion[] = [
  {
    major: 9,
    package: '@angular/material',
    candidate: 'tslib is a peer dependency instead of a dependency',
    category: 'outside-scope',
    reason: 'A package.json dependency change, not an API; the package manager reports the missing peer.',
    source: changelog(9),
  },
  {
    major: 10,
    package: '@angular/cdk/drag-drop',
    candidate: 'CdkDropList.start, drop, enter, exit and getItemIndex; CdkTable.setHeaderRowDef and setFooterRowDef',
    category: 'not-detectable',
    reason: NOT_TYPED,
    source: changelog(10),
  },
  {
    major: 10,
    package: '@angular/material/slide-toggle',
    candidate: 'MatSlideToggleDefaultOptions.disableDragValue and MatSlideToggle.dragChange',
    category: 'not-detectable',
    reason: 'An interface property and an instance member; neither can be tied to an import without type information.',
    source: changelog(10),
  },
  {
    major: 10,
    package: '@angular/material',
    candidate: 'Constructor parameters made required or removed (Platform, CdkCopyToClipboard, MatSlideToggle, MatAutocompleteTrigger, MatIcon, MatIconRegistry, MatSlider, MatSortHeader, MatTooltip)',
    category: 'not-detectable',
    reason: 'They matter only to classes that extend these; the scan does not check super calls.',
    source: changelog(10),
  },
  {
    major: 11,
    package: '@angular/material/snack-bar/testing',
    candidate: 'MatSnackBarHarness.getRole replaced with getAriaLive',
    category: 'not-detectable',
    reason: NOT_TYPED,
    source: changelog(11),
  },
  {
    major: 11,
    package: '@angular/material',
    candidate: 'Support for the node-sass package ends',
    category: 'outside-scope',
    reason: 'A build tool dependency, not an API in the files the scan reads.',
    source: changelog(11),
  },
  {
    major: 12,
    package: '@angular/cdk/accordion',
    candidate: 'AccordionItem disabled and expanded are strict booleans',
    category: 'not-detectable',
    reason: 'A typing change of instance properties.',
    source: changelog(12),
  },
  {
    major: 13,
    package: '@angular/material',
    candidate: 'Sass imports with a tilde (~@angular/material, ~@angular/cdk) and the minimum Sass version 1.34.0',
    category: 'outside-scope',
    reason: 'Stylesheets and build dependencies are not among the files the scan reads.',
    source: changelog(13),
  },
  {
    major: 13,
    package: '@angular/material',
    candidate: 'OverlayPositionBuilder.connectedTo, MatFormField.underlineRef, MatFormFieldHarness.getHarnessLoaderForPrefix and getHarnessLoaderForSuffix, MatTabHarness.getHarnessLoaderForContent',
    category: 'not-detectable',
    reason: NOT_TYPED,
    source: changelog(13),
  },
  {
    major: 13,
    package: '@angular/material',
    candidate: 'Constructor parameters removed from MatDatepicker, MatDateRangePicker and MatFormField',
    category: 'not-detectable',
    reason: 'They matter only to classes that extend these; the scan does not check super calls.',
    source: changelog(13),
  },
  {
    major: 14,
    package: '@angular/material',
    candidate: 'MatChipInputEvent.chipInput is required; mixinErrorState no longer defines stateChanges',
    category: 'not-detectable',
    reason: 'Typing changes with no removed export.',
    source: changelog(14),
  },
  {
    major: 14,
    package: '@angular/material/list',
    candidate: 'The mat-list-item-avatar CSS class is renamed to mat-list-item-with-avatar',
    category: 'outside-scope',
    reason: 'The component sets the class itself; overrides of it live in stylesheets, which the scan does not read.',
    source: changelog(14),
  },
  {
    major: 14,
    package: '@angular/material',
    candidate: 'MatSelectionListChange.option, MatSelectionList.tabIndex, list item harness getHarnessLoaderForContent, CdkStepper._orientation and the constructor parameters of MatSelectionList, CdkStepper and MatStepper',
    category: 'not-detectable',
    reason: `${NOT_TYPED} Constructor parameters matter only to subclasses.`,
    source: changelog(14),
  },
  {
    major: 15,
    package: '@angular/material',
    candidate: 'Components re-implemented on MDC with new DOM and CSS classes',
    category: 'not-detectable',
    reason: 'The TypeScript API stays largely the same; the changed DOM and class names affect styles and tests, not imports.',
    source: changelog(15),
  },
  {
    major: 17,
    package: '@angular/material',
    candidate: 'New base styles of the theme mixins, @import of Material and CDK Sass, mat.legacy-typography-hierarchy',
    category: 'outside-scope',
    reason: 'Sass changes; stylesheets are not among the files the scan reads.',
    source: changelog(17),
  },
  {
    major: 18,
    package: '@angular/material',
    candidate: 'Sass theming functions and palettes renamed with the m2- prefix',
    category: 'outside-scope',
    reason: 'Sass changes; stylesheets are not among the files the scan reads.',
    source: changelog(18),
  },
  {
    major: 19,
    package: '@angular/material',
    candidate: 'Style specificity of high-contrast, overlay and ripple styles; tokens emitted in place',
    category: 'outside-scope',
    reason: 'Sass and CSS changes; stylesheets are not among the files the scan reads.',
    source: changelog(19),
  },
  {
    major: 19,
    package: '@angular/material',
    candidate: 'MatButton.ripple, MatCheckbox.ripple and MatChip.ripple; type checking of CdkVirtualForOf contexts',
    category: 'not-detectable',
    reason: `${NOT_TYPED} The stricter template type checking is a typing change.`,
    source: changelog(19),
  },
  {
    major: 19,
    package: '@angular/google-maps',
    candidate: 'MapMarkerClusterer renamed to DeprecatedMapMarkerClusterer',
    category: 'outside-scope',
    reason: 'The Material and CDK data covers @angular/material and @angular/cdk only.',
    source: changelog(19),
  },
  {
    major: 20,
    package: '@angular/cdk',
    candidate: 'SelectionModel methods return a boolean; DragDropRegistry is no longer generic; DragDropRegistry.scroll removed',
    category: 'not-detectable',
    reason: `Typing changes. ${NOT_TYPED}`,
    source: changelog(20),
  },
  {
    major: 20,
    package: '@angular/material/button',
    candidate: 'ButtonVariant of MatButtonHarness no longer includes the appearance; [attr.tabindex] on Material buttons',
    category: 'not-detectable',
    reason: 'A changed harness return value, and a binding that is only wrong on a Material button, which text matching cannot tell apart.',
    source: changelog(20),
  },
  {
    major: 20,
    package: '@angular/cdk/portal',
    candidate: 'componentFactoryResolver of DialogConfig, MatDialogConfig and ComponentPortal; constructors of ComponentPortal and DomPortalOutlet',
    category: 'not-detectable',
    reason: 'Keys of config objects passed to instance methods and constructor arguments by position cannot be tied to the removed parameter.',
    source: changelog(20),
  },
  {
    major: 21,
    package: '@angular/cdk',
    candidate: 'Sass variables $z-index-overlay-container, $z-index-overlay, $dark-backdrop-background and $z-index-overlay-backdrop',
    category: 'outside-scope',
    reason: 'Sass changes; stylesheets are not among the files the scan reads.',
    source: changelog(21),
  },
  {
    major: 21,
    package: '@angular/material/core',
    candidate: 'NativeDateAdapter.useUtcForDisplay; TestElement implementations need setContenteditableValue',
    category: 'not-detectable',
    reason: `${NOT_TYPED} A new member to implement is a typing change.`,
    source: changelog(21),
  },
  {
    major: 21,
    package: '@angular/material-moment-adapter',
    candidate: 'MAT_MOMENT_DATE_ADAPTER_OPTIONS_FACTORY and MAT_LUXON_DATE_ADAPTER_OPTIONS_FACTORY removed',
    category: 'outside-scope',
    reason: 'The date adapter packages are not @angular/material or @angular/cdk.',
    source: changelog(21),
  },
  {
    major: 22,
    package: '@angular/cdk',
    candidate: 'Required injector of ConfigurableFocusTrap and FocusTrap; config object of ConfigurableFocusTrapFactory.create; required event of DropListRef.drop; constructors with rest arguments removed',
    category: 'not-detectable',
    reason: `${NOT_TYPED} Constructor parameters matter only to subclasses.`,
    source: changelog(22),
  },
  {
    major: 22,
    package: '@angular/aria',
    candidate: 'Legacy combobox removed, SimpleCombobox renamed to Combobox, values inputs renamed to value',
    category: 'outside-scope',
    reason: 'The Material and CDK data covers @angular/material and @angular/cdk only.',
    source: changelog(22),
  },
];
