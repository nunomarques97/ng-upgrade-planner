// Synthetic: inline templates.
import { Component } from '@angular/core';

@Component({
  selector: 'app-inline',
  template: `
    <a routerLink="/home" preserveQueryParams>Home</a>
    <!-- <ngForm> in a comment does not count -->
    <span>{{ value }}</span>
  `,
})
export class InlineTemplateComponent {
  value = 1;
}

@Component({ selector: 'app-inline-string', template: '<ngForm #f="ngForm"></ngForm>' })
export class InlineStringComponent {}

// Not a component decorator, so this template is not read.
export const notATemplate = { template: '<ngForm></ngForm>' };
