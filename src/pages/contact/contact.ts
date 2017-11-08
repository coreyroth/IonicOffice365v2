import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { GraphProvider } from './../../providers/graph-provider';

@Component({
  selector: 'page-contact',
  templateUrl: 'contact.html'
})
export class ContactPage {
  groups: Array<any>;

  constructor(public navCtrl: NavController, public graphProvider: GraphProvider) {
    this.getGroups();
  }

  getGroups() {
    this.graphProvider.getGroups()
      .then(groups => {
        this.groups = groups;
      }, error => {
        console.log("Error - ", error);
      });
  }  
}
