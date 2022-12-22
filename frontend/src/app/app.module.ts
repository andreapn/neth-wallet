import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";

import { AppComponent } from "./app.component";
import { SignInComponent } from "./components/sign-in/sign-in.component";
import { ContentComponent } from "./components/content/content.component";
import { AddressComponent } from "./components/address/address.component";

@NgModule({
  declarations: [
    AppComponent,
    SignInComponent,
    ContentComponent,
    AddressComponent,
  ],
  imports: [BrowserModule, FormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
