#!/bin/sh

export PORT="8083"
export TRUST_FORWARDED_IP="true" #only when the service is only exposed behind a reverse proxy
export FORUM_BACKEND_URI="http://127.0.0.1:8081"
export FORUM_BACKEND_ORIGIN="https://dani.forum"
export FILE_LOCATION="folder where attachments are stored"
export TEMP_FILE_LOCATION="folder where attachments are stored while uploading"

node bin/www > forum-attachments.log