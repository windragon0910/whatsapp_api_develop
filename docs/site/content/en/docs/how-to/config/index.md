---
title: "Configuration"
description: "Configuration"
lead: ""
date: 2020-10-06T08:48:45+00:00
lastmod: 2020-10-06T08:48:45+00:00
draft: false
images: [ ]
weight: 800
---

You can configure WhatsApp HTTP API behaviour via environment variables, by adding `-e WHATSAPP_VARNAME=value` at the
begging of the command line or by using [other options](https://docs.docker.com/engine/reference/commandline/run/)

```bash
docker run -it -e "WHATSAPP_HOOK_EVENTS=*" -e WHATSAPP_HOOK_URL=https://httpbin.org/post devlikeapro/whatsapp-http-api
```

It's not necessary to always run such a long command - you can save all data in
[docker-compose.yaml](https://github.com/devlikeapro/whatsapp-http-api/blob/core/docker-compose.yaml)
file as described on [How to deploy page ->]({{< relref "/docs/how-to/deploy" >}}).

## Environment variables

The following environment variables can be used to configure the WAHA:

- `DEBUG=1`: Set this variable to any value to enable debug and verbose logs.
- `WHATSAPP_API_PORT=3000`: The port number that the HTTP server will listen on. The default value is `3000`.
- `WHATSAPP_API_HOSTNAME=localhost`: The hostname for the HTTP server. The default value is `localhost`.
- `WHATSAPP_API_KEY=mysecret`: If you set this variable, you must include the `X-Api-Key: mysecret` header in all
  requests to the API. This will protect the API with a secret code.
- `WHATSAPP_SWAGGER_USERNAME=admin` and `WHATSAPP_SWAGGER_PASSWORD=admin`: These variables can be used to protect the
  Swagger panel with `admin / admin` credentials. This does not affect API access.
- `WHATSAPP_SWAGGER_CONFIG_ADVANCED=true` - enables advanced configuration options for Swagger documentation - you can customize host, port and base URL for the requests.
  Disabled by default.
- `WHATSAPP_RESTART_ALL_SESSIONS=True`: Set this variable to `True` to start all **STOPPED** sessions after container
  restarts. By default, this variable is set to `False`.
  - Please note that this will start all **STOPPED** sessions, not just the sessions that were working before the restart. You can maintain the session list by
    using `POST /api/session/stop` with the `logout: True` parameter or by calling `POST /api/session/logout` to remove
    **STOPPED** sessions. You can see all sessions, including **STOPPED** sessions, in the `GET /api/sessions/all=True`
    response.
- `WHATSAPP_START_SESSION=session1,session2`: This variable can be used to start sessions with the specified names right
  after launching the API. Separate session names with a comma.

### Examples

#### Debug Mode

To enable debug mode, set the `DEBUG` environment variable to any value:

```
DEBUG=1
```

#### Protecting the API with a Secret Code

To protect the API with a secret code, set the `WHATSAPP_API_KEY` environment variable to your secret code:

```
WHATSAPP_API_KEY=mysecret
```

You must include the `X-Api-Key: mysecret` header in all requests to the API.

#### Starting Sessions Automatically

To start sessions automatically when the API is launched, set the `WHATSAPP_START_SESSION` environment variable to a
comma-separated list of session names:

```
WHATSAPP_START_SESSION=session1,session2
```

#### Restarting All Sessions

To start all **STOPPED** sessions after container restarts, set the `WHATSAPP_RESTART_ALL_SESSIONS` environment variable
to `True`:

```
WHATSAPP_RESTART_ALL_SESSIONS=True
```

#### Protecting the Swagger Panel

To protect the Swagger panel with `admin / admin` credentials, set the `WHATSAPP_SWAGGER_USERNAME`
and `WHATSAPP_SWAGGER_PASSWORD` environment variables:

```
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=admin
```

## File storage variables ![](/images/versions/plus.png)


The following environment variables can be used to configure the file storage options for the WAHA:

- `WHATSAPP_FILES_MIMETYPES`: This variable can be used to download only specific mimetypes from messages. By default,
  all files are downloaded. The mimetypes must be separated by a comma, without spaces. For
  example: `audio,image/png,image/gif`. To choose a specific type, use a prefix (like `audio,image`).
- `WHATSAPP_FILES_LIFETIME`: This variable can be used to set the time (in seconds) after which files will be removed to
  free up space. The default value is `180`.
- `WHATSAPP_FILES_FOLDER`: This variable can be used to set the folder where files from chats (images, voice messages)
  will be stored. The default value is `/tmp/whatsapp-files`.

### Examples

#### Downloading Specific Mimetypes

To download only specific mimetypes from messages, set the `WHATSAPP_FILES_MIMETYPES` environment variable to a
comma-separated list of mimetypes:

```
WHATSAPP_FILES_MIMETYPES=audio,image/png,image/gif
```

#### Setting the File Lifetime

To set the time (in seconds) after which files will be removed to free up space, set the `WHATSAPP_FILES_LIFETIME`
environment variable:

```
WHATSAPP_FILES_LIFETIME=300
```

#### Setting the File Storage Folder

To set the folder where files from chats (images, voice messages) will be stored, set the `WHATSAPP_FILES_FOLDER`
environment variable:

```
WHATSAPP_FILES_FOLDER=/home/user/whatsapp-files
```
