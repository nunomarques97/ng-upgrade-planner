// Synthetic: names that appear only in comments and strings.
// import { Renderer } from '@angular/core';
/* ViewEncapsulation.Native and ReflectiveInjector are mentioned here only. */
import { Injectable } from '@angular/core';

/**
 * @see Renderer
 * import { TestBed } from '@angular/core/testing'; TestBed.get(x);
 */
@Injectable()
export class Notes {
  text = "import { Renderer } from '@angular/core'";
  more = 'ViewEncapsulation.Native';
  template = `<ngForm></ngForm> preserveQueryParams`;
}
