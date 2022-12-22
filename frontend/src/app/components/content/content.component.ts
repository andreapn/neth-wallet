import type { OnDestroy, OnInit } from "@angular/core";
import { Component, Input } from "@angular/core";
import { providers, utils } from "near-api-js";
import type {
  AccountView,
  CodeResult,
} from "near-api-js/lib/providers/provider";
import type { AccountState, Transaction } from "@near-wallet-selector/core";

import type { Message } from "../../interfaces/message";
import type { Account } from "../../interfaces/account";
import type { Subscription } from "rxjs";
import { distinctUntilChanged, map } from "rxjs";
import { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { WalletSelector } from "@near-wallet-selector/core";

@Component({
  selector: "neth-content",
  templateUrl: "./content.component.html",
  styleUrls: ["./content.component.scss"],
})
export class ContentComponent implements OnInit, OnDestroy {
  @Input() selector: WalletSelector;
  @Input() modal: WalletSelectorModal;
  @Input() accounts: Array<AccountState>;
  @Input() accountId: string | null;

  account: Account | null;
  messages: Array<Message>;
  subscription?: Subscription;

  async ngOnInit() {
    const [account] = await Promise.all([this.getAccount()]);

    this.account = account;
    this.subscribeToEvents();
  }


  async getAccount() {
    if (!this.accountId) {
      return null;
    }

    const { network } = this.selector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    return provider
      .query<AccountView>({
        request_type: "view_account",
        finality: "final",
        account_id: this.accountId,
      })
      .then((data) => ({
        ...data,
        account_id: this.accountId,
      }));
  }

  signIn() {
    this.modal.show();
  }

  async signOut() {
    const wallet = await this.selector.wallet();

    wallet.signOut().catch((err) => {
      console.log("Failed to sign out");
      console.error(err);
    });
  }

  switchWallet() {
    this.modal.show();
  }

  switchAccount() {
    const currentIndex = this.accounts.findIndex(
      (x) => x.accountId === this.accountId
    );
    const nextIndex =
      currentIndex < this.accounts.length - 1 ? currentIndex + 1 : 0;

    const nextAccountId = this.accounts[nextIndex].accountId;

    this.selector.setActiveAccount(nextAccountId);

    alert("Switched account to " + nextAccountId);
  }

  async onVerifyOwner() {
    const wallet = await this.selector.wallet();
    try {
      const owner = await wallet.verifyOwner({
        message: "test message for verification",
      });

      if (owner) {
        alert(`Signature for verification: ${JSON.stringify(owner)}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      alert(message);
    }
  }

  subscribeToEvents() {
    this.subscription = this.selector.store.observable
      .pipe(
        map((state) => state.accounts),
        distinctUntilChanged()
      )
      .subscribe((nextAccounts) => {
        console.log("Accounts Update", nextAccounts);

        this.accounts = nextAccounts;
        this.accountId =
          nextAccounts.find((account) => account.active)?.accountId || null;

        this.getAccount().then((account) => {
          this.account = account;
        });
      });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
