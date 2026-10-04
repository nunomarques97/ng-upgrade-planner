import { Component as View } from '@angular/core';
import { provideAnimations as enableAnimations, NoopAnimationsModule as NoMotion } from '@angular/platform-browser/animations';
import * as motion from '@angular/animations';

@View({
  selector: 'app-aliased',
  template: '',
  animations: [motion.trigger('fade', [])],
})
export class AliasedComponent {}

export const providers = [enableAnimations()];
export const testing = [NoMotion];
