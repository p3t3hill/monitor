const { exec } = require("child_process");


export async function restartService() {
  return new Promise<boolean>(res => {
    exec("sudo systemctl restart cosmovisor.service", (error: any, stdout: any, stderr: any) => {
      console.log('restarting service', stdout);
      res(true);
    });
  }
  );
}

export async function getServiceRunning() {
  return new Promise<boolean>(res => {
    exec("systemctl status cosmovisor.service | grep 'active (running)'", (error: any, stdout: any, stderr: any) => {
      if (stdout.includes('active (running)')) {
        res(true);
      }
      res(false);
    });
  }
  );
}

export async function getStatusFromNetwork(command: string, switchStdOutStdErr: boolean) {
  return new Promise<Status>(res => {
    // exec(command + " status -n tcp://localhost:26657", (error: any, stderr: any, stdout: any) => {
    exec(command + " status -n tcp://localhost:26657", (error: any, stdout: any, stderr: any) => {
      let errorStatus: Status;
      errorStatus = { latest_block: 0, power: null, environment: "ERROR", latest_block_time: null, catching_up: null };
      if (error) {
        console.log(`error: ${error.message}`);
        res(errorStatus);
      }
      if (switchStdOutStdErr) {
        // temp hack as regen returns stdOut and Error the wrong way around.
        let temp = stdout;
        stdout = stderr;
        stderr = temp;
      }

      if (stderr) {
        console.log(`stderr: ${stderr}`);
        res(errorStatus);
      }
      try {
        let status: Status;
        let data = JSON.parse(stdout);

        let environment: string;
        if (data.ValidatorInfo.VotingPower == null) {
          environment = "UNKNOWN";
        } else if (data.ValidatorInfo.VotingPower == 0) {
          environment = "BACKUP";
        } else if (data.ValidatorInfo.VotingPower > 0) {
          environment = "PRODUCTION";
        } else {
          environment = "UNKNOWN";
        }
        status = { latest_block: data.SyncInfo.latest_block_height, latest_block_time: data.SyncInfo.latest_block_time, power: data.ValidatorInfo.VotingPower, environment: environment, catching_up: data.SyncInfo.catching_up };
        res(status);
      } catch (e) {
        console.log(`err: ${e}`);

        res(errorStatus);
      }
    });
  });
}