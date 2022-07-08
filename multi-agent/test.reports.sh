#!/bin/bash

#########################
##       Setting       ##

testName='testX'
configPath='../configs/local.cbdc.test.json'

#########################

echo 'create dir: ./'$testName
mkdir $testName

echo 'find log files'
findfilenames=`ls ./test.*.log`

count=0
for eachfile in $findfilenames
do
    #echo $count $eachfile
    echo running... node verify.tx.latency.js $configPath $eachfile $count
    node  verify.tx.latency.js  $configPath  $eachfile  $count

    count=$(($count+1))
done

echo running... node verify.tx.latency2.js
node verify.tx.latency2.js

echo running... node verify.block.js
node verify.block.js

echo 'move results'
mv test.doc.node* ./$outFile/
mv verify.tx.report* ./$outFile/

echo 'done.'
