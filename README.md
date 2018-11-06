# Mediative FTP Sync

![Mediative Logo](https://omi.tv/img/logo.png)

Mediative FTP SYNC is a Node.js program that watch a directory and send all its content to a Mediative. It send files by chunks of 5MB and save medias in the Medias Pending section of the given Mediative.

# Installation

Just need to run:
> npm install && node start

# Configuration

Rename *.env-example* to .env, and write your Mediative Developer's credentials in the appropriate fields. That's all !

# Forever

To prevent the app from any crash, you should consider using [forever](https://www.npmjs.com/package/forever)
Install it one time, globally (root access required):
> npm install -g forever

Then you can start the app with forever:
> forever start index.js