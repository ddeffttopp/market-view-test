import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CollectionData } from '../../interface/collections.interface';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'app-currency-selector',
  templateUrl: './currency-selector.component.html',
  styleUrls: ['./currency-selector.component.scss']
})
export class CurrencySelectorComponent{
  private _collections: CollectionData[] = [];

  @Input()
  set collections(value: CollectionData[]) {
    this._collections = value;

    this.setDefaultSymbol();
  }

  get collections(): CollectionData[] {
    return this._collections;
  }

  @Output() symbolSelected = new EventEmitter<string>();

  selectedSymbolControl = new FormControl<string | null>(null);

  private setDefaultSymbol(): void {
    if (this._collections.length > 0 && !this.selectedSymbolControl.value) {
      const defaultSymbol = 'AUD/CAD';
      const defaultInstrument = this._collections.find(i => i.symbol === defaultSymbol);

      if (defaultInstrument) {
        this.selectedSymbolControl.setValue(defaultInstrument.symbol);
      } else {
        if (this._collections[0]) {
          this.selectedSymbolControl.setValue(this._collections[0].symbol);
        }
      }
    }
  }

  changeSymbol(): void {
    const selectedValue = this.selectedSymbolControl.value;

    if (selectedValue) {
      this.symbolSelected.emit(selectedValue);
    }
  }
}
