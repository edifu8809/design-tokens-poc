import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  IonApp,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  Brand,
  BRAND_MODES,
  ButtonComponent,
  CardComponent,
  InputComponent,
  ThemeMode,
  ThemeService,
} from '@design-tokens-poc/shared/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    IonApp,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonInput,
    ButtonComponent,
    CardComponent,
    InputComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly brands: Brand[] = ['mr', 'cuscatlan', 'gennius'];
  protected readonly modes: ThemeMode[] = ['light', 'dark'];

  protected isModeSupported(mode: ThemeMode): boolean {
    return BRAND_MODES[this.theme.brand()].includes(mode);
  }
}
