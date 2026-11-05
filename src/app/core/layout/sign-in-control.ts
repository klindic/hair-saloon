import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-sign-in-control',
  template: `
    <button type="button" [disabled]="disabled()" (click)="onClick()">Sign in with Google</button>
    @if (disabled()) {
      <p>{{ explanation() }}</p>
    }
  `,
})
export class SignInControl {
  readonly disabled = input<boolean>(true);
  readonly explanation = input<string>("Sign-in isn't connected in this preview yet."); // TODO(T-05): confirm exact copy

  readonly activate = output<void>();

  onClick(): void {
    if (this.disabled()) {
      return;
    }
    this.activate.emit();
  }
}
