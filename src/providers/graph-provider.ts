import { Injectable } from '@angular/core';
import { Http, Headers, ResponseContentType } from '@angular/http';
import { Platform, Events } from 'ionic-angular';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { AzureService } from './azure-service';
import { Resources } from './resources';
import 'rxjs/add/operator/map';


import { UserProfile } from './user-profile';

/*
  Generated class for the GraphProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class GraphProvider {
  appServiceLoggedIn: boolean = false;
  appServiceAuthenticationToken: string;
  appServiceAccessToken: string;
  appServiceUserName: string
  sid: string;
  redirectUrl: string = location.origin;
  userProfile: UserProfile;

  constructor(public http: Http, public platform: Platform, public events: Events, public inAppBrowser: InAppBrowser, public azureService: AzureService) {
    console.log('Hello GraphProvider Provider');
  }

  appServiceLogin(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      // HACK - required to be able to login from PWA / ionic serve because AAD login doesn't work in IFrame
      if (this.platform.is('core')) {
        let appServiceLoginUrl = Resources.azureMobileClientUrl + '/.auth/login/aad?session_mode=token&completion_type=postMessage&completion_origin=' + this.redirectUrl;

        // begin block of code from mobile services login script        
        var loginWindow = window.open(appServiceLoginUrl, "_blank", "location=no,resizable=yes"),
          complete = (errorValue, oauthValue) => {
            // Clean up event handlers, windows, frames, ...
            window.clearInterval(checkForWindowClosedInterval);
            loginWindow.close();
            if (window.removeEventListener) {
              window.removeEventListener("message", handlePostMessage);
            }

            this.appServiceLoggedIn = true;
            this.azureService.mobileServiceClient.currentUser = oauthValue.user;
            this.azureService.mobileServiceClient.currentUser.mobileServiceAuthenticationToken = oauthValue.authenticationToken;
            window.localStorage.setItem(Resources.appSeviceCurrentUserKey, JSON.stringify(this.azureService.mobileServiceClient.currentUser));

            this.appServiceAuthenticationToken = this.azureService.mobileServiceClient.currentUser.mobileServiceAuthenticationToken;
            window.localStorage.setItem(Resources.mobileServicesAuthenticationToken, this.appServiceAuthenticationToken);
            this.events.publish(Resources.appServiceLoginCompletedEventKey, {});
            this.sid = oauthValue.user.userId;

            this.processMobileLogin()
              .then(results => {
                resolve(results);
              }, error => {
                console.log('Mobile login - error processing', error);
                reject(error);
              });
          },
          handlePostMessage = function (evt) {
            // Validate source
            // var expectedSource = useIntermediateIframe ? intermediateIframe.contentWindow : loginWindow;
            var expectedSource = loginWindow;
            if (evt.source !== expectedSource) {
              return;
            }

            // Parse message
            var envelope;
            try {
              // Temporary workaround for IE8 bug until it is fixed in EA.
              if (typeof evt.data === 'string') {
                envelope = JSON.parse(evt.data);
              } else {
                envelope = evt.data;
              }
            } catch (ex) {
              // Not JSON - it's not for us. Ignore it and keep waiting for the next message.
              return;
            }

            // Process message only if it's for us
            if (envelope && envelope.type === "LoginCompleted" && (envelope.oauth || envelope.error)) {
              complete(envelope.error, envelope.oauth);
            }
          },
          checkForWindowClosedInterval = window.setInterval(function () {
            // We can't directly catch any "onclose" event from the popup because it's usually on a different
            // origin, but in all the mainstream browsers we can poll for changes to its "closed" property
            if (loginWindow && loginWindow.closed === true) {
              complete(new Error("canceled"), null);
            }
          }, 250);

        if (window.addEventListener) {
          window.addEventListener("message", handlePostMessage, false);
        }
      }
      else {
        this.azureService.mobileServiceClient.login('aad')
          .then(results => {
            console.log("App Service - Mobile - Logged in ", results)
            this.appServiceLoggedIn = true;
            window.localStorage.setItem(Resources.appSeviceCurrentUserKey, JSON.stringify(this.azureService.mobileServiceClient.currentUser));
            this.appServiceAuthenticationToken = this.azureService.mobileServiceClient.currentUser.mobileServiceAuthenticationToken;
            window.localStorage.setItem(Resources.mobileServicesAuthenticationToken, this.appServiceAuthenticationToken);
            this.events.publish(Resources.appServiceLoginCompletedEventKey, {});
            this.sid = results.userId;

            this.processMobileLogin()
              .then(results => {
                resolve(results);
              }, error => {
                console.log('Mobile login - error processing', error);
                reject(error);
              });
          }, error => {
            console.log("Login failure - ", error);
            reject(error);
          })
      }
    });
  }  

  processMobileLogin() {
    return new Promise<any>((resolve, reject) => {
      this.getIdentity(this.appServiceAuthenticationToken)
        .then(data => {

          resolve(data);
        }, error => {
          console.log("Error geting identity - ", error);
          reject(error);
        });
    });
  }

  getIdentity(token: string): Promise<any> {
    return new Promise<boolean>((resolve, reject) => {
      let apiUrl = Resources.azureMobileClientUrl + '/.auth/me';
      var headers = new Headers();
      headers.append('X-ZUMO-AUTH', token);
      return this.http.get(apiUrl, { headers: headers })
        .map(res => res.json())
        .subscribe(data => {
          console.log('App Service Identity - ', data);
          if (data[0].access_token != undefined)
            this.appServiceAccessToken = data[0].access_token;

          this.appServiceUserName = data[0].user_id;
          window.localStorage.setItem(Resources.appServiceAccessTokenKey, this.appServiceAccessToken);
          window.localStorage.setItem(Resources.appServiceUserNameKey, this.appServiceUserName);

          resolve(data);
        },
        error => {
          reject(error);
        },
        () => {
        });
    });
  }

  getUserProfile(): Promise<UserProfile> {
    return new Promise<UserProfile>((resolve, reject) => {
      let apiUrl = "https://graph.microsoft.com/beta/me";
      var headers = new Headers();
      headers.append('Authorization', 'Bearer ' + this.appServiceAccessToken);

      return this.http.get(apiUrl, { headers: headers })
        .map(res => res.json())
        .subscribe(data => {
          let userProfileValue = data;
          console.log("User Profile (graph) - ", userProfileValue);
          let userProfile: UserProfile = {
            userId: userProfileValue.id,
            businessPhones: JSON.stringify(userProfileValue.businessPhones),
            displayName: userProfileValue.displayName,
            givenName: userProfileValue.givenName,
            jobTitle: userProfileValue.jobTitle,
            mail: userProfileValue.mail,
            mobilePhone: userProfileValue.mobilePhone,
            officeLocation: userProfileValue.officeLocation,
            preferredLanguage: userProfileValue.preferredLanguage,
            surname: userProfileValue.surname,
            userPrincipalName: userProfileValue.userPrincipalName,
            photo: undefined,
            sid: this.sid
          }
          this.getUserProfilePhoto()
            .then(data => {
              console.log('User profile photo retrieved.');
              let reader = new FileReader();
              reader.onload = () => {
                userProfile.photo = reader.result;
                // set user profile twice because it is causing issues with the photo
                this.setUserProfile(userProfile);
              }
              reader.readAsDataURL(data._body);
              this.setUserProfile(userProfile);
              resolve(this.userProfile);
            }, error => {
              // save user profile even if we can't get the image
              console.log('Error getting user profile photo - ', error);
              this.setUserProfile(userProfile);
              resolve(this.userProfile);
            });
        },
        error => {
          console.log("Error - ", error);
          reject(error);
        },
        () => {
        });
    });
  }

  getUserProfilePhoto(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let apiUrl = "https://graph.microsoft.com/beta/me/photos/48x48/$value";
      var headers = new Headers();
      headers.append('Authorization', 'Bearer ' + this.appServiceAccessToken);

      return this.http.get(apiUrl, { headers: headers, responseType: ResponseContentType.Blob })
        .subscribe(data => {
          resolve(data);
        },
        error => {
          console.log("Error - ", error);
          reject(error);
        },
        () => {
        });
    });
  }

  setUserProfile(userProfile) {
    this.userProfile = userProfile;
  }

  logout() {
    window.localStorage.removeItem(Resources.appServiceAccessTokenKey);
    window.localStorage.removeItem(Resources.appServiceUserNameKey);
    window.localStorage.removeItem(Resources.mobileServicesAuthenticationToken);
    window.localStorage.removeItem(Resources.appSeviceCurrentUserKey);

    this.userProfile = undefined;
    this.appServiceLoggedIn = false;
    this.appServiceAccessToken = undefined;
    this.appServiceAuthenticationToken = undefined;
    this.azureService.mobileServiceClient.logout();

    if (this.platform.is('core')) {
      location.href = "https://login.microsoftonline.com/common/oauth2/v2.0/logout";
    }
    else {
      return this.logoutViaBrowser();
    }
  }

  logoutViaBrowser(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let browserRef = this.inAppBrowser.create("https://login.microsoftonline.com/common/oauth2/v2.0/logout", '_blank', 'location=no,hardwareback=no');
      browserRef.on("loadstart").subscribe(event => {
        console.log('Load Start');
        if ((event.url).indexOf("https://login.microsoftonline.com/common/oauth2/v2.0/logoutsession") === 0) {
          console.log('Mobile - Logged out');
          browserRef.close();

          this.events.publish(Resources.appServiceLogoutEventKey, {});
          resolve(true);

        }
      });
    });
  }

  getUsers(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let apiUrl = "https://graph.microsoft.com/beta/users";
      var headers = new Headers();
      headers.append('Authorization', 'Bearer ' + this.appServiceAccessToken);

      return this.http.get(apiUrl, { headers: headers })
        .map(res => res.json())
        .subscribe(data => {
          console.log("Data - ", data);
          resolve(data.value);
        },
        error => {
          console.log("Error - ", error);
          reject(error);
        },
        () => {
        });
    });
  }


  getGroups(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let apiUrl = "https://graph.microsoft.com/beta/groups?$orderBy=DisplayName";
      var headers = new Headers();
      headers.append('Authorization', 'Bearer ' + this.appServiceAccessToken);

      return this.http.get(apiUrl, { headers: headers })
        .map(res => res.json())
        .subscribe(data => {
          console.log("Data - ", data);
          resolve(data.value);
        },
        error => {
          console.log("Error - ", error);
          reject(error);
        },
        () => {
        });
    });
  }
}
