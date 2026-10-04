import { Component } from '@angular/core';

// import { trigger } from '@angular/animations';
/* provideAnimations() from '@angular/platform-browser/animations', BrowserAnimationsModule */
@Component({
  selector: 'app-notes',
  template: `<p>Use provideAnimationsAsync() or withIncrementalHydration() no more.</p>`,
})
export class NotesComponent {
  readonly hint = "import { trigger } from '@angular/animations'";
  readonly other = 'animations: [] in @Component';
}
