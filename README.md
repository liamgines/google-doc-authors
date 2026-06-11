Google Doc Authors
========
A web app for examining authorship in Google Docs.

![Demo](demo.gif)
![Screenshot](1.png)
![Screenshot](2.png)
![Screenshot](3.png)

Remarks
--------
I built this so you can easily see what everyone added to a document in Google Drive.<br>
This might be helpful to anyone that's working on a group assignment.

Installation
--------
First, ensure you have Node.js and Docker installed. Then, run the following commands:
```
git clone <repository_url>
cd google-doc-authors
```

Environment File
--------
Next, create a `.env` file in the project's root directory with the following structure:
```
PUBLIC_SERVER_PORT={server_port}
PUBLIC_GOOGLE_CLIENT_ID={google_api_client_id}
PUBLIC_GOOGLE_APP_ID={google_project_number}
PUBLIC_GOOGLE_PICKER_API_KEY={google_picker_api_key}

PRIVATE_DATABASE_CONNECTION_STRING={database_connection_string}
PRIVATE_GOOGLE_CLIENT_SECRET={google_client_secret}
PRIVATE_EXPRESS_SESSION_SECRET={secret_string}
```

A variable prefixed with `PUBLIC_` means both the server and client can access it.<br>
A variable prefixed with `PRIVATE_` means only the server can access it.

Database
--------
Install the `postgres` image using Docker Desktop. Then initialize the database:
```
cd server
npm run start-database
npm run seed-database
```

To stop the database:
```
npm run stop-database
```

### Obtaining the Connection String
By default, the connection string is `postgres://postgres:password@localhost:5432/app`.<br>
If you want to change this, you can update `server/compose.yaml`.

Google Cloud
--------
Visit the Google Cloud Console website.<br>
Then create a new project by clicking `Select a project` > `New project` > `Create`.<br>
Click `Select a project` again and choose the project you just created.

### Obtaining Google Cloud Credentials
**App ID**: On Google Cloud Console's `Welcome` page, you can find the App ID listed under `Project number`.

**Client ID and Secret**: Use the search bar on Google Cloud Console to find the `Google Auth Platform` page.
Once you've found it, click `Clients` > `Get started`. Provide an app name and user support email. Select `External` audience. Provide a contact email. Then click `Create`.
You can now create a client. To do so, click `Clients` and choose `Web application` as the `Application type`. Provide a name for the web client.
Under `Authorized JavaScript origins`, add `http://localhost` and `http://localhost:{client_port}` as Uniform Resource Identifiers (URIs). Then click `Create`.
You should now be able to see the `Client ID` and `Client secret`.

**Google Picker API Key**: Use the search bar on Google Cloud Console to find the `APIs & Services` page.
Click `Credentials` > `Create credentials` > `API key`. Under `Select API restrictions`, choose `Google Picker API` and `Google Drive API`.
Note that if you can't find these APIs in the dropdown, you must enable them in Google's `API Library` before proceeding.
Moving on, ensure `Authenticate API calls through a service account` is unchecked. Under `Application restrictions`, select `Websites`.
Then under `Website restrictions`, add `http://localhost:{client_port}`. Finish by clicking `Create`.
You can now click `Show key` next to the API key you created to view it.

### Adding Developer-Approved Testers to your Project
Use the search bar on Google Cloud Console to find the `Google Auth Platform` page.<br>
Once you've found it, click `Audience` > `Add users` and provide at least one email that you want to use for testing.

Server
--------
To run the server:
```
cd server
npm install
npm run server
```

Client
--------
To run the client:
```
cd client
npm install
npm run client
```

With everything running, you can visit `http://localhost:{client_port}` to test the app.
