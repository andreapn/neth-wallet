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
import { of } from "rxjs";
import { distinctUntilChanged, map } from "rxjs";
import { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { WMEAR_CONTRACT } from "../../../constants";
import { WalletSelector } from "@near-wallet-selector/core";
import { Contract } from "ethers";
import Big from "big.js";

const SUGGESTED_DONATION = "0";
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const BOATLOAD_OF_GAS = utils.format.parseNearAmount("0.00000000003")!;
const ONE_YOCTO_NEAR = "0.000000000000000000000001";

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
  balance: string;
  currentAmount: string;
  subscription?: Subscription;

  async ngOnInit() {
    const [account] = await Promise.all([this.getAccount()]);

    this.account = account;
    this.balance = utils.format.formatNearAmount(
      account !== null ? account.amount : "",
      2
    );

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

  async send(e: any) {
    const wallet = await this.selector.wallet();
    const { fieldset, address, ft_contract, amount } = e.target.elements;
    this.validate(address.value);
    const ft_token = ft_contract.value;
    const ftMetaData = await this.callFunction(ft_token, "ft_metadata", {});
    console.log(ftMetaData);
    const transactions: Array<Transaction> = [];
    if (ft_token === WMEAR_CONTRACT) {
      const depositWNearTx: Transaction = {
        signerId: this.accountId!,
        receiverId: WMEAR_CONTRACT,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "near_deposit",
              args: {},
              gas: BOATLOAD_OF_GAS,
              deposit: utils.format.parseNearAmount(amount.value)!,
            },
          },
        ],
      };
      transactions.push(depositWNearTx);
      1;
    }

    const sentAmount = BigInt(
      Number(amount.value) * 10 ** Number(ftMetaData.decimals)
    ).toString();
    console.log(sentAmount);
    const ftTransferTx: Transaction = {
      signerId: this.accountId!,
      receiverId: ft_token,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer",
            args: {
              receiver_id: address.value,
              amount: sentAmount!,
            },
            gas: BOATLOAD_OF_GAS,
            deposit: utils.format.parseNearAmount(ONE_YOCTO_NEAR)!,
          },
        },
      ],
    };
    transactions.push(ftTransferTx);

    return wallet.signAndSendTransactions({ transactions }).catch((err) => {
      alert("Failed to near_deposit");
      console.log("Failed to near_deposit");
      throw err;
    });
  }

  async validateAddress(e: any) {
    const { network } = this.selector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });
    const address = e.target.value;

    if (address.length !== 0) {
      return await this.validate(address);
    }
  }

  async validate(address: any) {
    const { network } = this.selector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });
    return provider
      .query<CodeResult>({
        request_type: "view_account",
        account_id: address,
        finality: "optimistic",
      })
      .then((res) => console.log(res))
      .catch((err) => alert(err.message));
  }

  async callFunction(contractId: string, methodName: string, args: any) {
    const { network } = this.selector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });
    const res: any = await provider
      .query({
        request_type: "call_function",
        account_id: contractId,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
        finality: "optimistic",
      })
      .catch((err) => {
        alert(err.message);
      });
    return JSON.parse(Buffer.from(res.result).toString());
  }

  async checkTokenBalance(e: any) {
    const address = e.target.value;
    if (address.length !== 0) {
      const ftMetaData = await this.callFunction(address, "ft_metadata", {});
      const current = await this.callFunction(address, "ft_balance_of", {
        account_id: this.account?.account_id,
      });
      this.currentAmount = Big(current)
        .div(10 ** ftMetaData.decimals)
        .toString();
    }
  }
}
