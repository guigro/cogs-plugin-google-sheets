# COGS Google Sheets plugin

## How to use

### Google Account setup

- Create a Google Cloud project, if you haven't already: https://console.cloud.google.com/apis
- Add a new Service Account to the project: https://console.cloud.google.com/iam-admin/serviceaccounts
- Add the email address of this Service Account as an `Editor` to the Google Sheet you want to update.
- Create new API key for the service account by clicking on the email address in the Service Accounts list, then clicking the 'KEYS' -> 'ADD KEY' -> 'Create New Key' and pick the 'JSON' type.
- Enable the Google Sheet API: https://console.cloud.google.com/marketplace/product/google/sheets.googleapis.com


### Install the plugin

- Download the plugin from [Releases](https://github.com/clockwork-dog/cogs-plugin-google-sheets/releases/latest)
- Unzip into the `plugins` folder in your COGS project
- In COGS, open the project and go to `Setup` > `Settings` and enable `Google Sheets`
- Click the `Google Sheets` icon that appears on the left
- Setup the config for the plugin:
    - **Service Account JSON**: Copy the entire contents of the JSON key you created earlier into here
    - **Spreadsheet ID**: Copy the ID of the spreadsheet you want to update here. The ID can be found by looking at the URL when editing the spreadsheet. The ID is in the URL between `/spreadsheets/d/` and `/edit`
     - **Tab Name**: The tab name within the spreadsheet that you wish to add rows to. In a brand new spreadsheet this is usually "Sheet1"

You can now use the `Google Sheets: Append Row` action in your behaviours.
You can also use the `Google Sheets: Add to existing Row` action to add values to an existing row after already entered value. The way it works, is that the first column should be a common value (like an ID key). If this value already exists in your Google Sheets, all values you enter there will be added after the last non-empty column. If the ID does not exists, it will create it.

## Local development in a browser

- Place this folder in the `client-content` folder in your COGS project.
- Add a "Custom" Media Master called "Google Sheets plugin dev" in COGS and select the `Custom` type
- Select `cogs-plugin-google-sheets/build` as the content directory

```
yarn start "Google Sheets plugin dev"
```

This will connect to COGS as a simulator for the Media Master called "Google Sheets plugin dev".

## Build for your COGS project

```
yarn build
```

This folder can now be used as a plugin. Place the entire folder in the `plugins` folder of your COGS project and follow the "How to use" instructions above.
