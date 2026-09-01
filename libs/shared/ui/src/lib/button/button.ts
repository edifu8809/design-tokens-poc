import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.html',
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-button-host',
  },
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  disabled = input(false);
  type = input<'button' | 'submit'>('button');
}
