#!/bin/bash
############################################
#  Setting  

# testCaseName = $testNamePrefix'_'$testSorterOpt'_'$testBlockSelectTxTime'_'$testTps'_'$testDurationSec'
testNamePrefix='testRC6_A'

testSorterOptArr=( 0 1 2 3 )

testBlockSelectTxTime=0

testNodesArr=( 'http://172.19.10.201:8545/' 'http://172.19.10.215:8545/' 'http://172.19.20.79:8545/' 'http://172.19.20.113:8545/' )

############################################

function changeSorterModeX {
    sleep 1

    echo 'admin_changeBlockTxSorterMode:' $1 $2
    curl -X POST --data '{"jsonrpc":"2.0","method":"admin_changeBlockTxSorterMode","params":["'$1'"],"id":'$1'}' $2
    exitCode=$?
    if [ $exitCode -ne 0 ] ; then
        echo 'exit by fail (admin_changeBlockTxSorterMode ['$1'] -> exitCode:'$exitCode')'
        
        changeSorterModeX $1 $2
    fi
    sleep 1
}

function changeTxSelectTimeX {
    sleep 1

    echo 'admin_changeBlockTxSelectTime:' $1 $2
    curl -X POST --data '{"jsonrpc":"2.0","method":"admin_changeBlockTxSelectTime","params":["'$1'"],"id":'$1'}' $2
    exitCode=$?
    if [ $exitCode -ne 0 ] ; then
        echo 'exit by fail (admin_changeBlockTxSelectTime ['$1'] -> exitCode:'$exitCode')'
        
        changeTxSelectTimeX $1 $2
    fi
    sleep 1
}

function changeSorterMode {

    for varNode in "${testNodesArr[@]}"
    do
        changeSorterModeX $1 $varNode
    done
}

function changeTxSelectTime {

    for varNode in "${testNodesArr[@]}"
    do
        changeTxSelectTimeX $1 $varNode
    done
}

function runTestCase {

    for varOpt in "${testSorterOptArr[@]}"
    do
        changeSorterMode $varOpt
        # changeSorterModeX $varOpt 'http://172.19.10.201:8545/'
        # changeSorterModeX $varOpt 'http://172.19.10.215:8545/'
        # changeSorterModeX $varOpt 'http://172.19.20.79:8545/'
        # changeSorterModeX $varOpt 'http://172.19.20.113:8545/'

        testCaseName=$testNamePrefix'_'$varOpt'_'$testBlockSelectTxTime
        echo -e '\n***** [' $testCaseName '] *****\n'
        sleep 5
        echo 'sh ./auto.sub.test.sh' $testCaseName
        bash ./auto.sub.test.sh $testCaseName

    done
}

# select time : 0 (default)
runTestCase

#####################################################
# need to modified
testSorterOptArr=( 1 2 3 )

testBlockSelectTxTime=500

changeTxSelectTime $testBlockSelectTxTime
# changeTxSelectTimeX $testBlockSelectTxTime 'http://172.19.10.201:8545/'
# changeTxSelectTimeX $testBlockSelectTxTime 'http://172.19.10.215:8545/'
# changeTxSelectTimeX $testBlockSelectTxTime 'http://172.19.20.79:8545/'
# changeTxSelectTimeX $testBlockSelectTxTime 'http://172.19.20.113:8545/'

# select time : 500 ms (user defined)
runTestCase


echo 'done.'
