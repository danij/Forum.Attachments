#!/bin/bash
HOSTNAME="$1"

mkdir /forum/data/attachments
mkdir /forum/temp/attachments
mkdir /forum/logs/Forum.Attachments

cp /forum/repos/Forum.Attachments/docker/start.sh /forum/start/Forum.Attachments.sh
chmod +x /forum/start/Forum.Attachments.sh

sed -i 's#bin/www#/forum/repos/Forum.Attachments/bin/www#' /forum/start/Forum.Attachments.sh
sed -i 's#forum-attachments.log#/forum/logs/Forum.Attachments/forum-attachments.log#' /forum/start/Forum.Attachments.sh
sed -i 's#FILE_LOCATION="[^"]*"#FILE_LOCATION="/forum/data/attachments"#' /forum/start/Forum.Attachments.sh
sed -i 's#TEMP_FILE_LOCATION="[^"]*"#TEMP_FILE_LOCATION="/forum/temp/attachments"#' /forum/start/Forum.Attachments.sh
sed -i "s#dani.forum#$HOSTNAME#" /forum/start/Forum.Attachments.sh
