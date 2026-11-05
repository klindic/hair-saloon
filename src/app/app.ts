import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DemoModeBanner } from './core/layout/demo-mode-banner';
import { SignInControl } from './core/layout/sign-in-control';

@Component({
  imports: [RouterOutlet, DemoModeBanner, SignInControl],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
