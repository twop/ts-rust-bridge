import { parentPort } from "worker_threads";
import { writeMessage, readMessage, WorkerMsg, printExecTime } from "./message";

parentPort!.on("message", (msg: WorkerMsg) => {
  switch (msg.tag) {
    case "json":
      parentPort!.postMessage(msg);
      break;
    case "msg_arr": {
      const arr = new Uint8Array(msg.val);
      const hrstart = process.hrtime();
      const toSend = writeMessage(readMessage(arr), arr).buffer;
      const hrend = process.hrtime(hrstart);
      parentPort!.postMessage(toSend, [toSend]);

      printExecTime("worker-serde", hrend);
    }
  }
});
