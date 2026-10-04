import { NgModule } from '@angular/core';
import { JAN, MatCommonModule } from '@angular/material/core';
import { PortalInjector } from '@angular/cdk/portal';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatButtonModule } from '@angular/material';
import { matSelectAnimations } from '@angular/material/select';
import { CKD_COPY_TO_CLIPBOARD_CONFIG } from '@angular/cdk/clipboard';

export const wrap = matSelectAnimations.transformPanelWrap;
export const first = JAN;

@NgModule({
  imports: [MatCommonModule, MatLegacyButtonModule, MatButtonModule],
  providers: [{ provide: CKD_COPY_TO_CLIPBOARD_CONFIG, useValue: {} }],
})
export class SharedModule {
  injector?: PortalInjector;
}
