import type { OnInit } from "@angular/core";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import Big from "big.js";
import { Account } from "../../interfaces/account";

@Component({
  selector: "address-form",
  templateUrl: "./address.component.html",
  styleUrls: ["./address.component.scss"],
})
export class AddressComponent implements OnInit {
  @Input() account: Account;
  @Input() balance: string;
  @Input() currentAmount: string;
  @Output() sendEvent: any = new EventEmitter();
  @Output() focusOutEvent: any = new EventEmitter();
  @Output() getBalanceEvent: any = new EventEmitter();
  maxValue: string;

  ngOnInit(): void {
    this.maxValue = Big(this.account.amount)
      .div(10 ** 24)
      .toString();
  }

  onSubmit(event: any) {
    this.sendEvent.emit(event);
  }

  checkAddress(event: any) {
    this.focusOutEvent.emit(event);
  }

  getTokenBalance(event: any) {
    this.getBalanceEvent.emit(event);
  }
}
