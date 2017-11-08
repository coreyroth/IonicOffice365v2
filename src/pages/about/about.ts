import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { GraphProvider } from './../../providers/graph-provider';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {
  users: Array<any>;

  constructor(public navCtrl: NavController, public graphProvider: GraphProvider) {
    this.getUsers();

  }
  getUsers() {
    this.graphProvider.getUsers()
      .then(users => {
        this.users = users;
      }, error => {
        console.log("Error - ", error);
      });
  }

}
