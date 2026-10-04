import { Renderer } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

export const providers = [provideNoopAnimations()];
export type R = Renderer;
