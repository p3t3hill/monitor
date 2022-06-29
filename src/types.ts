
type Status = {
    latest_block: number;
    latest_block_time: Date | null;
    catching_up: boolean | null;
    power: number | null;
    environment: string;
  }
  
  type NodeData = {
    hostname: string;
    createdAt: Date;
    latestBlock: number | null;
    latestBlockTime: Date | null;
    catchingUp: boolean | null;
    processed: number | null;
    ip: string;
    diskSpaceUsedPercent: number | undefined;
    info: string | undefined;
    monitored: boolean;
    system: string;
    cosmosBased: boolean;
    isHealthy: boolean | null; //Ava only currently
    power: number | null;
    environment: string | null;
  };