#!/bin/bash
echo $DAEMON_NAME
VAR1=$("$DAEMON_NAME" status | jq '.ValidatorInfo.VotingPower' | tr -d '"') || VAR1=-1
echo $VAR1
echo $DAEMON_NAME
echo $DAEMON_HOME

if [ -z "$VAR1" ]; then
    echo "System is Unknown - Can not backup!!"
elif [ $VAR1 -gt 0 ]; then
    echo "System is Production"
    tar cvfP "$DAEMON_NAME"_PRODUCTION.tar "$DAEMON_HOME"/config
else
    echo "System is Backup"
    tar cvfP "$DAEMON_NAME"_BACKUP.tar "$DAEMON_HOME"/config
fi