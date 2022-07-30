#!/bin/bash
############################################
#  Setting  

# testCaseName = $testNamePrefix'_'$testTps'_'$testDurationSec
#testNamePrefix='testA_0'
testNamePrefix=$1

testDurationSec=600    # test time (send tx)
waitUserTimeSec=240    # waiting for interval
waitIncreaseSec=20     # waiting for interval

#testTpsArr=( 1000 1050 1100 1150 1200 1250 1300 1350 )
#testTpsArr=( 1000 1050 1100 1120 1140 1160 1180 1200 1220 1240 1260 1280 1300 1350 )
testTpsArr=( 1000 1050 1080 1100 1120 1140 1160 1180 1200 1220 1240 1260 1280 1300 1320 1350 )

confPath='../configs/local.cbdc.test.json'
confIP='172.19.30.121'
reportUrl='http://'$confIP':10080/message'
txpoolUrl='http://'$confIP':10081/txpool'
############################################

function waitSleep {
    step=$(($1/10))
    #echo " *** sleep ("$1" seconds) ***" 
    while [ $step -gt 0 ]
    do
        ((step--))
        sleep 10
        prog=$((100 - $step * 1000 / $1))
        echo -ne '##### ('$prog'%) remain to run next test '$(($step*10))' seconds\r'
    done
}

function checkTxPool {
    # check tx pool API
    echo 'check tx pool api'
    TXSG=$(curl $txpoolUrl)
    #echo ''
    echo $TXSG
    if [[ $TXSG == '{"result":0}' ]] ; then
        echo 'txpool is empty.'
    fi
    if [[ $TXSG != '{"result":0}' ]] ; then
        echo '[ERROR] txpool is not empty.'
        # wait for txpool empty
        waitSleep 3600
        # end
        exit 1
    fi

    # restart API
    echo 'restart agent api'
    curl -X POST --data '{"jsonrpc":"2.0", "method":"xxx", "params":["restartnodes"], "id":12}' $reportUrl
    echo ''

    waitSleep 10
}

function waitIntervalWork {

    # sleep time
    waitUserTimeSec=$(($waitUserTimeSec - $waitIncreaseSec - $waitIncreaseSec))
    echo 'ready for settle ... '$waitUserTimeSec 's ('$1')'
    waitSleep $waitUserTimeSec

    # reporting API
    echo 'reporting api ('$1')'
    curl -X POST --data '{"jsonrpc":"2.0", "method":"xxx", "params":["'$1'"], "id":11}' $reportUrl
    echo ''

    # sleep time
    waitUserTimeSec=$(($waitUserTimeSec + $waitIncreaseSec + $waitIncreaseSec + $waitIncreaseSec))
    echo 'ready for reporting ... '$waitUserTimeSec 's'
    waitSleep $waitUserTimeSec

    checkTxPool
}

# node  temp2Main_single_thread.js "config-path" [ "agent_ip(localhost)" "tps(100tps)" "TestTime(600s) ]"
# node --max-old-space-size=4096  temp2Main_single_thread.js  ../configs/local.cbdc.test.json  172.19.30.121  400  10

checkTxPool

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
