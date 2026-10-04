import { Component } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AnimationDriver } from '@angular/animations/browser';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';

@Component({
  selector: 'app-panel',
  template: '<div [@open]="isOpen"></div>',
  animations: [trigger('open', [state('true', style({ height: '*' })), transition('* => *', animate(200))])],
})
export class PanelComponent {
  isOpen = true;
}

export const providers = [provideAnimations(), provideAnimationsAsync(), provideClientHydration(withIncrementalHydration())];
export const modules = [BrowserAnimationsModule];
export type Driver = AnimationDriver;
