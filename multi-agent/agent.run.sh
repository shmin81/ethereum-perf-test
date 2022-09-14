#!/bin/bash

echo 'stop agent'
curl -X GET "http://localhost:10080/serverExit"

echo '\nstart agent'
nohup node controlAgent.js ../configs/dev-local.json ./test.Agent.erc20.js true > agent.log 2>&1 &
#nohup node controlAgent.js ../configs/local.cbdc.test.json ./test.Agent.doc.js true > agent.docu.log 2>&1 &
#nohup node controlAgent.js ../configs/dev-local.json ./test.Agent.chainz.doc.js true > agent.log 2>&1 &
