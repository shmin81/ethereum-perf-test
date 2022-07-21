#!/bin/bash
# 
############################################
#  Setting  

testDurationSec=10    # test time (send tx)
waitUserTimeSec=10    # waiting for interval

testTpsArr=( 1120 1140 1160 1180 1200 )

# testCaseName = $testNamePrefix'_'$testTps'_'$testDurationSec
testNamePrefix='testA_0'

confPath='../configs/local.cbdc.test.json'
confIP='172.19.30.121'
reportUrl='http://'$confIP':10080/message'
############################################

function waitSleep {
    step=$(($1/2))
    #echo " *** sleep ("$1" seconds) ***" 
    while [ $step -gt 0 ]
    do
        ((step--))
        sleep 2
        prog=$(($step * 200 / $1))
        echo -ne '##### ('$prog'%) remain to run next test '$(($step*2))' seconds\r'
    done
}

function waitIntervalWork {

    # sleep time
    echo 'ready for settle ... '$waitUserTimeSec 's ('$1')'
    waitSleep $waitUserTimeSec

    # reporting API
    echo 'reporting api ('$1')'
    curl -X POST --data '{"jsonrpc":"2.0", "method":"xxx", "params":["'$1'"], "id":11}' $reportUrl
    echo ''

    # sleep time
    echo 'ready for reporting ... '$waitUserTimeSec 's'
    waitSleep $waitUserTimeSec
}

# node  temp2Main_single_thread.js "config-path" [ "agent_ip(localhost)" "tps(100tps)" "TestTime(600s) ]"
# node --max-old-space-size=4096  temp2Main_single_thread.js  ../configs/local.cbdc.test.json  172.19.30.121  400  10

for varTps in "${testTpsArr[@]}"
do
    testCaseName=$testNamePrefix'_'$varTps'_'$testDurationSec
    echo -e '\n*** ' $testCaseName ' ***\n'
    sleep 5
    echo 'node tps2Main_transferMulti.js' $confPath $confIP $varTps $testDurationSec
    node --max-old-space-size=4096  tps2Main_transferMulti.js $confPath $confIP $varTps $testDurationSec
    exitCode=$?
    if [ $exitCode -ne 0 ] ; then
        echo 'exit by fail ('$testCaseName' -> exitCode:'$exitCode')'
        exit 1
    fi
    echo 'the end!'

    waitIntervalWork $testCaseName

done

echo 'done.'
