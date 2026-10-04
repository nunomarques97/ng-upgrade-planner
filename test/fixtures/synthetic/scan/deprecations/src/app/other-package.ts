import { Component } from '@angular/core';
import { Component as Widget } from 'other-framework';
import { provideAnimations, trigger } from 'other-animations';
import { BrowserAnimationsModule } from './local-animations';
import { ANIMATION_MODULE_TYPE } from '@angular/platform-browser/animations';
import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';

@Widget({
  animations: [trigger('fade', [])],
})
export class WidgetComponent {}

@Component({
  selector: 'app-plain',
  template: '',
})
export class PlainComponent {
  options = { animations: [] };
}

export const providers = [provideAnimations(), provideClientHydration(withNoIncrementalHydration())];
export const modules = [BrowserAnimationsModule];
export const token = ANIMATION_MODULE_TYPE;
