import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfig } from '../config/app-config';
import { ConfigService } from '../config/config.service';
import { DemoModeBanner } from './demo-mode-banner';

const BANNER_TEXT = 'This is a preview — bookings made here are not sent to the salon.';

function configureWith(demoMode: boolean) {
  const config = signal<AppConfig>({
    auth0Domain: '',
    auth0ClientId: '',
    apiBaseUrl: '',
    demoMode,
  });

  TestBed.overrideProvider(ConfigService, {
    useValue: { config: config.asReadonly() },
  });
}

describe('DemoModeBanner', () => {
  it('renders the banner text when demoMode is true', async () => {
    configureWith(true);
    const fixture = TestBed.createComponent(DemoModeBanner);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.trim()).toBe(BANNER_TEXT);
  });

  it('renders nothing when demoMode is false', async () => {
    configureWith(false);
    const fixture = TestBed.createComponent(DemoModeBanner);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.trim()).toBe('');
  });

  it('never renders a button or dismiss control', async () => {
    configureWith(true);
    const fixture = TestBed.createComponent(DemoModeBanner);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('button')).toBeNull();
    expect(compiled.querySelector('[aria-label*="close" i]')).toBeNull();
  });
});
