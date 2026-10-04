import { Component } from '@angular/core';

// MatCommonModule from '@angular/material/core' was removed in 21.
/* import { PortalInjector } from '@angular/cdk/portal'; */
export const note = "import { MatCommonModule } from '@angular/material/core'";
export const legacy = `@angular/material/legacy-button and matTextareaAutosize`;

@Component({ selector: 'app-notes', template: '<p>Notes</p>' })
export class NotesComponent {}
