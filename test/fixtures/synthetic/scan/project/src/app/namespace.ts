// Synthetic: namespace imports.
import * as ng from '@angular/core';
import * as router from '@angular/router';

export const renderer: ng.Renderer | null = null;
export const factory = ng.Renderer;
export const mode = ng.ViewEncapsulation.Native;
export let providers: ng.ModuleWithProviders;

@ng.Component({ selector: 'app-ns', moduleId: 'x', template: '' })
export class NamespaceComponent {}

export const routes = router.RouterModule.forRoot([], { malformedUriErrorHandler: () => null });
