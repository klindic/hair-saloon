import { TestBed } from '@angular/core/testing';
import { SignInControl } from './sign-in-control';

describe('SignInControl', () => {
  it('disables the button and shows the explanation when disabled is true', async () => {
    const fixture = TestBed.createComponent(SignInControl);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(compiled.querySelector('p')?.textContent).toBe(
      "Sign-in isn't connected in this preview yet."
    );
  });

  it('enables the button and hides the explanation when disabled is false', async () => {
    const fixture = TestBed.createComponent(SignInControl);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button')!;
    expect(button.disabled).toBe(false);
    expect(compiled.querySelector('p')).toBeNull();
  });

  it('does not emit activate when clicked while disabled', async () => {
    const fixture = TestBed.createComponent(SignInControl);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const activated = vi.fn();
    fixture.componentInstance.activate.subscribe(activated);

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button')!;
    button.click();

    expect(activated).not.toHaveBeenCalled();
  });

  it('emits activate when clicked while enabled', async () => {
    const fixture = TestBed.createComponent(SignInControl);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const activated = vi.fn();
    fixture.componentInstance.activate.subscribe(activated);

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button')!;
    button.click();

    expect(activated).toHaveBeenCalledTimes(1);
  });
});
