// Synthetic: the same names from other packages, which must not count.
import { Renderer, ViewEncapsulation, ModuleWithProviders } from 'some-renderer-library';
import { TestBed } from '@angular/core';
import { XhrFactory } from '@angular/common';
import * as notAngular from 'not-angular';

export const mode = ViewEncapsulation.Native;
export const value = TestBed.get(Renderer);
export const local: ModuleWithProviders | null = null;
export const ns = notAngular.Renderer;
export const factory = XhrFactory;

function shadow(): void {
  const ReflectiveInjector = { create: () => null };
  ReflectiveInjector.create();
}
shadow();
