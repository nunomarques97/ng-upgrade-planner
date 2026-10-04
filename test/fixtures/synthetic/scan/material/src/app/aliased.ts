import { DomPortalHost as Host } from '@angular/cdk/portal';
import * as overlay from '@angular/cdk/overlay';
import * as stepper from '@angular/material/stepper';

export type Strategy = overlay.ConnectedPositionStrategy;
export const host: Host | null = null;
export const vertical = stepper.MatVerticalStepper;
export const current = stepper.MatStepper;
