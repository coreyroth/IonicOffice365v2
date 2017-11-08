import { Injectable } from '@angular/core';
import { Platform, Events } from 'ionic-angular';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';

declare var WindowsAzure: any;

import { Resources } from './resources';

@Injectable()
export class AzureService {
    mobileServiceClient: any;
    store: any;
    syncContext: any;

    constructor (platform: Platform, public events: Events) {
        console.log('Hello AzureService');
        platform.ready().then(() => {
            console.log('AzureService - Platform ready');
            this.mobileServiceClient = new WindowsAzure.MobileServiceClient(Resources.azureMobileClientUrl);

        });
    }

    getMobileServiceClient(): any {
        return this.mobileServiceClient;
    }
    
}
