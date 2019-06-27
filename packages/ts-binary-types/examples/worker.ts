import { parentPort } from "worker_threads";
import { writeMessage, readMessage, WorkerMsg } from "./message";

parentPort!.on("message", (msg: WorkerMsg) => {
  switch (msg.tag) {
    case "json":
      parentPort!.postMessage(msg);
      break;
    case "msg_arr": {
      const toSend = writeMessage(readMessage(msg.val), msg.val);
      parentPort!.postMessage(toSend, [toSend]);
    }
  }
});
