import { Component } from '@angular/core';
import { MatCommonModule } from './local-material';
import { DomPortalHost, PortalInjector } from 'ngx-portal-shim';
import { JAN } from 'date-constants';
import { MatButtonModule } from '@angular/material/button';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { ContextMenuTracker } from '@angular/cdk-experimental/menu';
import { CdkPortal } from '@angular/cdk/portal';
import { matSelectAnimations } from './animations';

export const wrap = matSelectAnimations.transformPanelWrap;
export const used = [MatCommonModule, DomPortalHost, PortalInjector, JAN, MatButtonModule, MomentDateAdapter, ContextMenuTracker, CdkPortal];

@Component({ selector: 'app-plain', template: '<textarea cdkTextareaAutosize cdkAutosizeMinRows="2"></textarea>' })
export class PlainComponent {}
