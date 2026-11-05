import { Component, computed, inject } from '@angular/core';
import { ConfigService } from '../config/config.service';

const BANNER_STYLE = 'background: #fff3cd;'; // TODO(T-06): replace with token

@Component({
  selector: 'app-demo-mode-banner',
  template: `
    @if (demoMode()) {
      <div role="status" [style]="bannerStyle">
        This is a preview — bookings made here are not sent to the salon.
      </div>
    }
  `,
})
export class DemoModeBanner {
  private readonly configService = inject(ConfigService);

  readonly demoMode = computed(() => this.configService.config().demoMode);
  readonly bannerStyle = BANNER_STYLE;
}
