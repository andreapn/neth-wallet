import type { OnInit } from "@angular/core";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import Big from "big.js";
import { Account } from "../../interfaces/account";
import { providers, utils } from "near-api-js";
import { WalletSelector, Transaction } from "@near-wallet-selector/core";
import type { CodeResult } from "near-api-js/lib/providers/provider";
import { WMEAR_CONTRACT } from "../../../constants";

const BOATLOAD_OF_GAS = utils.format.parseNearAmount("0.00000000003")!;
const ONE_YOCTO_NEAR = "0.000000000000000000000001";

@Component({
  selector: "address-form",
  templateUrl: "./address.component.html",
  styleUrls: ["./address.component.scss"],
})
export class AddressComponent implements OnInit {
  @Input() account: Account;
  @Input() selector: WalletSelector;
  @Output() sendEvent: any = new EventEmitter();
  maxValue: string;
  currentAmount: string;
  decimals: any;
  wNearBalance: any;

  async ngOnInit() {
    this.maxValue = Big(this.account.amount)
      .div(10 ** 24)
      .toString();
    this.wNearBalance = await this.getTokenBalance(WMEAR_CONTRACT);
  }

  // use for event
  async callCheckAddress(event: any){
    const address = event.target.value;
    if (address.length !== 0) {
      return this.checkAddress(address);
    }
    return false;
  }

  // Check address existed
  async checkAddress(address: any) {
    const { network } = this.selector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });
    let res: any;
    try { 
      res = await provider
      .query<CodeResult>({
        request_type: "view_account",
        account_id: address,
        finality: "optimistic",
      });
      return true;
    } catch(err: any) {
      alert(err.message);
    }
    return false;
  }

  async callGetTokenBalance(event: any){
    const address = event.target.value;
    this.getTokenBalance(address);
  }

  // get token balance
  async getTokenBalance(address: any) {
    if (address.length !== 0) {
      // Get balance
      const current = await this.callFunction(address, "ft_balance_of", {
        account_id: this.account?.account_id,
      });

      if (address === WMEAR_CONTRACT) {
        this.currentAmount = this.account.amount;
      } else {
        this.currentAmount = current;
      }

      // Set token address value
      const tokenField: any = document.getElementById('ft_contract');
      tokenField.value = address;  

      // Get decimals
      const ftMetaData = await this.callFunction(address, "ft_metadata", {});
      this.decimals = ftMetaData.decimals;
      return current;
    } 
    return 0;
  }
  // Common call function
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

  // Display balance as string
  formatBalance(input: any, decimals: any) {
    if (input !== undefined && decimals !== undefined) {
      return Big(input)
        .div(10 ** decimals)
        .toString();
    }else {
      return "";
    }
  }

  // Display balance as string
  formatNear(input: any) {
    return utils.format.formatNearAmount(input, 2);
  }

  //Set balance to max 
  setMax() {
    const amount: any = document.getElementById('amount');
    amount ? amount.value = this.formatBalance(this.currentAmount, this.decimals) : 0;  
  }

  async send(e: any) {
    const wallet = await this.selector.wallet();
    const { fieldset, address, ft_contract, amount } = e.target.elements;
    this.checkAddress(address.value);
    const ft_token = ft_contract.value;
    const ftMetaData = await this.callFunction(ft_token, "ft_metadata", {});
    const transactions: Array<Transaction> = [];
    let storageCost: any = 0;
    if (ft_token === WMEAR_CONTRACT) {
      const checkFirstDeposit = await this.callFunction(WMEAR_CONTRACT, "storage_balance_of", {
        account_id: this.account?.account_id,
      });
      
      if(checkFirstDeposit === null) {
        storageCost = BigInt(Number(0.00125) * 10 ** 24);
      }

      const depositWNearTx: Transaction = {
        signerId: this.account.account_id!,
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
    }
    const sentAmount = Big(amount.value).mul(10 ** ftMetaData.decimals - storageCost).toFixed();
    const ftTransferTx: Transaction = {
      signerId: this.account.account_id!,
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

    return wallet.signAndSendTransactions({ transactions })
      .then((res) => {
        location.reload();
      })
      .catch((err) => {
        console.log("Failed tx");
        throw err;
      });
  }

  async withdrawWNear() {
    const wallet = await this.selector.wallet();
    const withdrawWNearTx: Transaction = {
      signerId: this.account.account_id!,
      receiverId: WMEAR_CONTRACT,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "near_withdraw",
            args: {
              amount: this.wNearBalance
            } ,
            gas: BOATLOAD_OF_GAS,
            deposit: utils.format.parseNearAmount(ONE_YOCTO_NEAR)!,
          },
        },
      ],
    } 
    return wallet.signAndSendTransaction(withdrawWNearTx)
      .then((res) => {
        location.reload();
      })
      .catch((err) => {
        console.log("Failed tx");
        throw err;
      });
  }
}
