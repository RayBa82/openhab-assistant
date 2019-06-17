# OpenHAB Google Assistant Action

This contains a fully functioning OpenHAB
cloud service designed to work with Actions on Google. This can be used with a
Actions Console project to create an Action interface.

## Setup Instructions

See the developer guide and release notes at [https://developers.google.com/actions/](https://developers.google.com/actions/) for more details.

Clone the project:

```
git clone https://github.com/RayBa82/openhab-assistant.git
cd openhab-assistant
```

## Steps for testing with Google Assistant

### Create and set up project in Actions Console

1. Use the [Actions on Google Console](https://console.actions.google.com) to add a new project with a name of your choosing and click *Create Project*.
1. Select *Home Control*, then click *Smart Home*.

### Optional: Customize your action

1. On the left navigation menu under *SETUP*, click on *Invocation*.
1. Add your App's name. Click *Save*.
1. On the left navigation menu under *DEPLOY*, click on *Directory Information*.
1. Add your App info, including images, a contact email and privacy policy. This information can all be edited before submitting for review.
1. Click *Save*.

### Add Request Sync and Report State
The Request Sync feature allows a cloud integration to send a request to the Home Graph
to send a new SYNC request. The Report State feature allows a cloud integration to proactively
provide the current state of devices to the Home Graph without a `QUERY` request. These are
done securely through [JWT (JSON web tokens)](https://jwt.io/).

1. Navigate to the
[Google Cloud Console API Manager](https://console.developers.google.com/apis)
for your project id.
1. Enable the [HomeGraph API](https://console.cloud.google.com/apis/api/homegraph.googleapis.com/overview).
1. Navigate to the [Google Cloud Console API & Services page](https://console.cloud.google.com/apis/credentials)
1. Select **Create Credentials** and create a **Service account key**
    1. Create a new Service account
    1. Use the role Service Account > Service Account Token Creator
1. Create the account and download a JSON file.
   Save this as `src/smart-home-key.json`.

### Deploy server to App Engine

1. Run `npm install`
1. Run `npm run build`

You can deploy directly to [Google App Engine](https://cloud.google.com/appengine/) by running
`npm run deploy`. If you do, you will first need the [gcloud CLI](https://cloud.google.com/sdk/docs/#install_the_latest_cloud_tools_version_cloudsdk_current_version).

### Run standalone

1. Run `npm run build`.
1. Run `npm run start:local`.

## Create OAuth Credentials on Google Cloud

You'll need to create OAuth credentials to enable API access.

* Visit the [Credentials Page](https://console.cloud.google.com/apis/credentials)
  1. Select "Create Credentials" -> "OAuth client id"
  1. Select Web Application and give it a name. I left the restrictions open.
* Copy the client id and the client secret, you'll need these in the next step.

## Setup project

  1. Select your existing "Actions on Google" project
  1. Select "Smart Home Actions". 
     * If using Google App Engine, the URL will be https://{project-id}.appspot.com/smarthome
  1. Fill out all the App information. Feel free to use fake data and images, you're not actually going to submit this.
  1. Move on to Account linking.
    * Select Authorization Code
    * Enter the client ID and client secret from the OAuth Credentials you created earlier
    * Authorization URL should be something like: `https://openhab.myserver.com/oauth2/authorize`
    * Token URL should be something like `https://openhab.myserver.com/oauth2/token`
    * Set the scope to `google-assistant`. This links to the records you will insert into the MongoDB table `oauth2scopes` later in [Setup your Database](#setup-your-database) step below.
    * Testing instructions: "None"
  1. Hit save. You're not actually going to submit this for testing, we just need to set it up so we can deploy it later.
  

## Setup your Database

* SSH into to your openHAB Cloud instance
* Open the mongodb client `mongo` and enter these commands

```
use openhab
db.oauth2clients.insert({ clientId: "<CLIENT-ID>", clientSecret: "<CLIENT SECRET>"})
db.oauth2scopes.insert({ name: "any"})
db.oauth2scopes.insert( { name : "google-assistant", description: "Access to openHAB Cloud specific API for Actions on Google Assistant", } )
```

## License
See [LICENSE](LICENSE).
 