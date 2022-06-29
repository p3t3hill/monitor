import { Config } from "./config";
import { mkdir } from 'fs';

const firebase = require('firebase');

const schedule = require('node-schedule');
const helpers = require("./helpers");
const dataService = require("./data");
const types = require("./types");
//const regenService = require("./regen");
let config: Config = require('../config.json');
const avaService = require('./ava');
const cosmosService = require('./cosmosBased');
const ftp = require("basic-ftp")
var path = require("path");


let system = "";
let autoUpdate = false;
let data: NodeData;
let db: any;
let systemInfo: any;
let thisValidator: any = null;
let swapStdOut: boolean = false;

start();

// get any args
var args = process.argv.slice(2);
if (args[0] === 'autoUpdate') {
  // not used
  autoUpdate = true;
}

// On Start
//dataService.deleteOldData(db, systemInfo.hostname);
//dataService.queueEmail(db, 'Validator Monitor Started', systemInfo.hostname);

// Get balance
// regen query bank balances regen174tvh2dty7vsvwn2cfsmkwq8tplqgr5fduvkkk  --chain-id regen-1


async function start() {
  // Firebase
  let firebaseConfig = getFirebaseConfig(config);
  firebase.initializeApp(firebaseConfig)

  await firebase.auth().signInWithEmailAndPassword("pete@petehill.co.uk", config.firebasePassword)
    .then((userCredential: any) => {
      // Signed in
      var user = userCredential.user;
      console.log('Signed In OK');

      db = firebase.firestore();
      systemInfo = helpers.getSystemInfo();
      setThisValidator();

      helpers.setUpEMail();

      dataService.queueEmail(db, 'Validator Monitor Started', systemInfo.hostname, systemInfo.hostname);



      runAll();


    })
    .catch((error: any) => {
      var errorCode = error.code;
      var errorMessage = error.message;
      console.log(errorMessage);
    });

}

// 1 Minute Timer
const job = schedule.scheduleJob('*/1 * * * *', async function () {
  minute();
});

// every hour
const hourJob = schedule.scheduleJob('0 * * * *', function () {
  hourly();
});

// every day (at 9am)
const dayjob = schedule.scheduleJob('0 9 * * *', function () {
  daily();
});

async function minute() {

  try {
    await reportStatus();
  } catch (error) {
    console.log('error reporting status', error);
  }

  try {
    console.log('SystemType', thisValidator.systemType);
    monitor();
  } catch (error) {
    console.log('error monitoring', error);
  }

  var even = (new Date().getMinutes() % 2) == 0;
  if (even) {
    await delay(30000); // wait 30 so doesn't clash with other checks.
    //only do this on even minute to avoid to0 many restarts
    try {
      if (thisValidator.restartRequired) {
        console.log("A restart is required");
        dataService.queueEmail(db, "Restaring Service: " + systemInfo.hostname, "", systemInfo.hostname);
        thisValidator.restartRequired = false;
        dataService.setRestartRequired(db, thisValidator.name, false); // Set it directly now as well.
        restartService();
      }

    } catch (error) {
      console.log('error restart', error);
    }
  }


}

async function hourly() {
  dataService.deleteOldData(db, systemInfo.hostname);
  dataService.deleteOldEmails(db)
  monitorDiskSpace();
  // if (autoUpdate){
  //   helpers.updateMonitor();
  // }
}

async function daily() {
  const diskSpace = await helpers.getDiskSpace();
  let message = "Current disk space used is " + helpers.roundToTwo(diskSpace) + "%";
  message += "\n";
  message += "Just so you know...";
  dataService.queueEmail(db, "Monitor is running: " + systemInfo.hostname, message, systemInfo.hostname);

  backupConfig();
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setThisValidator() {
  thisValidator = await dataService.getValidator(db, systemInfo.hostname);
  console.log('this Validator', thisValidator);

  //system = thisValidator.systemType;
  // exmaple data in firestore
  // active:true
  // exe:"/home/pete/go/bin/emd"
  // id:6
  // lastMonitorCheck:5 October 2021 at 14:36:00 UTC+1
  // lastMonitorCheckBy:"regen"
  // name:"emoney"
  // systemType:"em"
  // cosmosBased:true
}

async function runAll() {
  await delay(3000);
  daily();
  hourly();
  minute();
}

async function reportStatus() {
  setThisValidator();
  console.log('123', thisValidator);
  if (thisValidator.systemType === "ava") {
    const isHealthy = await avaService.isAvaHealthy();
    data = {
      hostname: systemInfo.hostname,
      createdAt: new Date(),
      diskSpaceUsedPercent: await helpers.getDiskSpace(),
      info: '',
      ip: systemInfo.ip,
      system: thisValidator.systemType,
      cosmosBased: thisValidator.cosmosBased,
      monitored: false,
      isHealthy: isHealthy,
      latestBlock: null, // not used in ava
      processed: null, // not used in ava
      power: null,
      environment: null,
      latestBlockTime: null,
      catchingUp: null
    };
    dataService.saveData(db, data);
  } else if (thisValidator.cosmosBased) {

    if (thisValidator.dynamic) {
      var even = (new Date().getMinutes() % 2) == 0;
      if (even) {
        // skip even mins as dynamic doesn't always process blocks.
        return;
      }
    }

    let command = thisValidator.exe;
    const status: Status = await cosmosService.getStatusFromNetwork(command, swapStdOut);

    if (status.environment === "ERROR") {
      // Looks like this network has the stdout mixed up - switch it up
      console.log('Looks like this network has the stdout mixed up - switch it up');
      swapStdOut = !swapStdOut;
    }

    console.log('status', status);
    const dbLatestBlock = await dataService.getLatestBlockFromDB(db, systemInfo.hostname);
    data = {
      hostname: systemInfo.hostname,
      createdAt: new Date(),
      latestBlock: status.latest_block,
      latestBlockTime: status.latest_block_time,
      catchingUp: status.catching_up,
      diskSpaceUsedPercent: await helpers.getDiskSpace(),
      info: '',
      ip: systemInfo.ip,
      processed: status.latest_block - dbLatestBlock,
      system: thisValidator.systemType,
      cosmosBased: thisValidator.cosmosBased,
      monitored: false,
      isHealthy: null, // not used in regen
      power: status.power,
      environment: status.environment
    };
    dataService.saveData(db, data);
  } else {
    console.log("Unknown System...");
  }


}

function getFirebaseConfig(config: Config) {
  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId
  };
}

async function sendEmails() {
  const waitMS = 2000 + (Math.random() * 10000);
  console.log('waiting before send emails', waitMS);
  await helpers.delay(waitMS); // 0 to 10 secs
  const validators = await dataService.getEmails(db);
  validators.forEach(async (email: any) => {
    console.log('found email', email);
    var result = await helpers.sendTheEmail(email.subject, email.message);
    if (result == true) {
      email.sent = true;
      email.sentAt = new Date;
      email.sentBy = thisValidator.name;
      dataService.saveEmail(db, email);
    }
  });
}
async function monitorDiskSpace() {
  const validators = await dataService.getValidators(db);
  validators.forEach(async (validator: any) => {
    const latestValidatorData = await dataService.getLatestData(db, validator.name);
    const diskspaceOverThreshold = isdiskspaceOverThreshold(latestValidatorData);
    // check diskspace
    if (diskspaceOverThreshold) {
      const percent = latestValidatorData.diskSpaceUsedPercent;
      console.log("Diskspace running low:" + validator.name);
      dataService.queueEmail(db, "Diskspace running low:" + validator.name + " at " + Math.round(percent) + "%", "Better get looking into this... percent:" + percent, systemInfo.hostname);
    }


  });
}

async function restartService() {
  let running = await cosmosService.getServiceRunning();
  if (running) {
    await cosmosService.restartService();
  }
}

async function monitor() {
  // Wait a random amount
  const waitMS = Math.random() * 10000;
  console.log('waiting', waitMS);
  await helpers.delay(waitMS); // 0 to 10 secs
  const validators = await dataService.getValidators(db);
  validators.forEach(async (validator: any) => {
    console.log('Checking: ', validator.name);
    var lastUpdatedSecsAgo = new Date().getTime() - validator.lastMonitorCheck.seconds * 1000;
    const FORTY_SECS = 40 * 1000
    const AN_HOUR = 60 * 60 * 1000
    const FIVE_MINS = 5 * 60 * 1000
    console.log(lastUpdatedSecsAgo, validator.lastMonitorCheck.seconds);

    if (lastUpdatedSecsAgo > FORTY_SECS) {
      // check healthy
      const latestValidatorData = await dataService.getLatestData(db, validator.name);
      let restartRequired: boolean = false;
      if (thisValidator.restartRequired !== undefined) {
        restartRequired = thisValidator.restartRequired;
      }

      if (latestValidatorData) {
        const running = await isValidatorRunning(latestValidatorData, validator);
        if (!running) {

          console.log("Validator Down:" + validator.name);

          let message = "Latest Block: " + latestValidatorData.latestBlock + "\n";
          message += "Latest Block Time: " + latestValidatorData.latestBlockTime + "\n";
          message += "Processed: " + latestValidatorData.processed + "\n";
          message += "Catching Up: " + latestValidatorData.catchingUp + "\n";
          message += "Disk Space Used: " + latestValidatorData.diskSpaceUsedPercent + "\n";
          message += "Environment: " + latestValidatorData.environment + "\n";
          dataService.queueEmail(db, latestValidatorData.environment + "Validator Down:" + validator.name, message, systemInfo.hostname);


          // If it's been down for X mins, ask for a restart of the service
          // Down means latest block not changing or not reported
          var lastUpdateSecAgo = new Date().getTime() - latestValidatorData.createdAt.seconds * 1000;
          const fiveAgoValidatorData = await dataService.getFiveAgoData(db, validator.name);
          if (fiveAgoValidatorData !== null) {
            console.log(fiveAgoValidatorData.latestBlock, latestValidatorData.latestBlock)
            if (fiveAgoValidatorData.latestBlock == latestValidatorData.latestBlock) {
              // Blocks are not moving, try a restart
              restartRequired = true;
            } else if (lastUpdateSecAgo > FIVE_MINS) {
              restartRequired = true;
            }
          } else {
            // no data found - might not be sensible to try a restart
            restartRequired = false;
          }
          console.log('peete', fiveAgoValidatorData);
        }

      } else {
        console.log('No Data Yet...');

      }
      validator.restartRequired = restartRequired;
      validator.lastMonitorCheck = new Date();
      validator.lastMonitorCheckBy = systemInfo.hostname;
      dataService.saveValidator(db, validator.name, validator);
    } else {
      console.log('Monitor Check Not Required');
    }
  });

  // Now send any emails
  sendEmails();
}

function isValidatorRunning(latestValidatorData: any, validator: any): boolean {
  let running = false;
  try {
    console.log('Checking', latestValidatorData.hostname);
    if (latestValidatorData.system === "ava") {
      running = isAvaValidatorRunning(latestValidatorData);
    } else if (latestValidatorData.cosmosBased) {
      running = isCosmosBasedValidatorRunning(latestValidatorData, validator);
    } else {
      console.log("Unknown System........");
    }
  } catch (error) {

  }

  return running;

}

function isdiskspaceOverThreshold(latestValidatorData: any): boolean {

  if (latestValidatorData.diskSpaceUsedPercent > 80) {
    return true;
  } else {
    return false;
  }

}

function isAvaValidatorRunning(data: any): any {
  console.log(data.hostname + " running " + data.system + " is running?", data.isHealthy);
  return data.isHealthy;
}

function isCosmosBasedValidatorRunning(data: any, validator: any) {
  let running = false;
  let expectedBlocks = 1;
  var TIMEAGO = 2 * 60 * 1000; /*  (2 MINS)  */

  if (validator.dynamic) {
    TIMEAGO = 3 * 60 * 1000; /*  (3 MINS)  */
  }

  if (validator.expectedBlocksPerInterval != undefined) {
    expectedBlocks = validator.expectedBlocksPerInterval;
  }

  console.log('Expected Blocks', expectedBlocks);


  var now = new Date;
  if (data) {
    var lastUpdate = now.getTime() - data.createdAt.seconds * 1000;
    if (data.processed >= expectedBlocks && lastUpdate < TIMEAGO) {
      running = true;
    } else {
      console.log('latestBlock', data.latestBlock);
      console.log('number processed', data.processed);
      console.log('is last update over ' + TIMEAGO + 'ms ago', lastUpdate < TIMEAGO);
    }
  }
  console.log(data.hostname + " running " + data.system + " is running?", running);
  return running;
}

async function backupConfig() {


  if (thisValidator.cosmosBased) {
    let command = thisValidator.exe;
    const status: Status = await cosmosService.getStatusFromNetwork(command, swapStdOut);

    if (status.environment === "ERROR") {
      // Looks like this network has the stdout mixed up - switch it up
      console.log('Looks like this network has the stdout mixed up - switch it up');
      swapStdOut = !swapStdOut;
    } else if (status.environment !== "UNKNOWN") {
      var tar = require('tar');
      mkdir('/home/pete/backups/config', { recursive: true }, (err) => {
        if (err) throw err;
      });
      const filename = '/home/pete/backups/config/' + thisValidator.systemType + '_' + status.environment + '.tar';
      tar.c(
        {
          gzip: false,
          file: filename
        },
        [thisValidator.path + '/config']
      ).then((_: any) => {
        console.log("done");
        sendFile(filename);
      })
    } else {
      console.log("No Zip required for UNKNOWN System.");
    }
  } else {
    console.log("No Config backup availble for this systemType");
  }
}

async function sendFile(file: any) {

  if (config.ftpPassword != undefined) {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
      await client.access({
        host: "petehill.co.uk",
        user: "valbackup@petehill.co.uk",
        password: config.ftpPassword,
        secure: false
      });
      //console.log(await client.list());
      await client.uploadFrom(file, path.basename(file));

    }
    catch (err) {
      console.log(err);
    }
    client.close();
  } else {
    console.log('NO FTP PASSWORD!!');
  }
}

// function isRegenValidatorRunning(data: any) {
//   let running = false;
//   var TWO_MINS = 2 * 60 * 1000; /* ms */
//   var now = new Date;
//   if (data) {
//     var lastUpdate = now.getTime() - data.createdAt.seconds * 1000;
//     if (data.processed > 0 && lastUpdate < TWO_MINS) {
//       running = true;
//     }
//   }
//   console.log(data.hostname + " running " + data.system + " is running?", running);
//   return running;
// }


// function isOsmoValidatorRunning(data: any) {
//   let running = false;
//   var TWO_MINS = 2 * 60 * 1000; /* ms */
//   var now = new Date;
//   if (data) {
//     var lastUpdate = now.getTime() - data.createdAt.seconds * 1000;
//     if (data.processed > 0 && lastUpdate < TWO_MINS) {
//       running = true;
//     }
//   }
//   console.log(data.hostname + " running " + data.system + " is running?", running);
//   return running;
// }