const { exec } = require("child_process");


export async function isAvaHealthy() {

  const command = "curl -X POST --data '{ \"jsonrpc\": \"2.0\",\"method\": \"health.health\", \"id\": 1 }' -H 'content-type:application/json;' 127.0.0.1:9650/ext/health";
  

  return new Promise<boolean>(res => {
    exec(command, (error: any, stderr: any, stdout: any) => {
      // Note sure why stderr and stout are both returning data...
      if (error) {
        console.log(`error: ${error.message}`);
        res(false);
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        //res(false);
      }
      try {
        console.log(JSON.parse(stderr));
        res(JSON.parse(stderr).result.healthy);
      } catch (e) {
        console.log(`err: ${e}`);
        res(false);
      }
    });
  });
}

