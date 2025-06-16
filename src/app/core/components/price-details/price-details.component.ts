import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-price-details',
  templateUrl: './price-details.component.html',
  styleUrls: ['./price-details.component.scss']
})
export class PriceDetailsComponent {
  @Input() symbol: string | null = null;
  @Input() price: number | null = null;
  @Input() time: string | null = null;
}
