// Synthetic: named imports of removed or changed APIs.
import { ModuleWithProviders, NgModule, Renderer, ViewEncapsulation } from '@angular/core';
import { XhrFactory } from '@angular/common/http';
import { async, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import '@angular/platform-webworker';

export const encapsulation = ViewEncapsulation.Native;
export const fine = ViewEncapsulation.Emulated;

export function forRoot(): ModuleWithProviders {
  return { ngModule: AppModule };
}

export function forChild(): ModuleWithProviders<AppModule> {
  return { ngModule: AppModule };
}

export const routing = RouterModule.forRoot([], { relativeLinkResolution: 'legacy' });
export const service = TestBed.get(Renderer);

@NgModule({ entryComponents: [] })
export class AppModule {}

export async function load(): Promise<unknown> {
  return import('@angular/platform-webworker-dynamic');
}

export const helpers = [async, XhrFactory];
