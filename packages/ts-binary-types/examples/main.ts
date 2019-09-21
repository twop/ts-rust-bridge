import { Worker } from "worker_threads";
import { join } from "path";
import {
  genMessage,
  Msg,
  writeMessage,
  readMessage,
  WorkerMsg,
  printExecTime
} from "./message";

// import { Sink, Serializer, bindesc } from "../src/index";

// const log = console.log;
// const measure = (name: string, func: () => void) => {
//   //log(`\n${' '.repeat(4)}${name}`);

//   // let fastest = 100500;

//   const numberOfRuns = 1;
//   const takeTop = 1;

//   let runs: number[] = [];
//   for (let i = 0; i < numberOfRuns; i++) {
//     const hrstart = process.hrtime();
//     func();
//     const hrend = process.hrtime(hrstart);

//     const current = hrend[1] / 1000000;

//     runs.push(current);

//     // fastest = Math.min(fastest, current);
//   }

//   const result = runs
//     .sort((a, b) => a - b)
//     .slice(numberOfRuns - takeTop, numberOfRuns)
//     .reduce((s, v) => s + v, 0);

//   log(`${name}: ${result.toFixed(2)} ms`);
// };

const COUNT = 100;
const stopGC: any[] = [];

const messages = Array.from({ length: COUNT }, () => genMessage(10));

const worker = new Worker(join(__dirname, "worker.js"));

const sendMsgObj = (msg: Msg) =>
  worker.postMessage({ tag: "json", val: msg } as WorkerMsg);

const measureJson = () => {
  let i = 0;
  const recieved = new Array<Msg>(messages.length);
  stopGC.push(recieved);
  const hrstart = process.hrtime();

  worker.on("message", (msg: Msg) => {
    recieved[i] = msg;
    i++;
    if (i < messages.length) {
      sendMsgObj(messages[i]);
    } else {
      worker.removeAllListeners("message");

      const hrend = process.hrtime(hrstart);

      printExecTime("native", hrend);

      measureBinary();
    }
  });

  sendMsgObj(messages[0]);
};

const sendMsgBin = (msg: Msg, arr: Uint8Array) => {
  const toSend = writeMessage(msg, arr).buffer;
  const workerMsg: WorkerMsg = { tag: "msg_arr", val: toSend };
  worker.postMessage(workerMsg, [toSend]);
  //   return worker.postMessage(toSend, [toSend]);
};

const measureBinary = () => {
  let i = 0;
  const recieved = new Array<Msg>(messages.length);
  stopGC.push(recieved);

  const hrstart = process.hrtime();

  let ping_time = process.hrtime();
  let pong_time = process.hrtime();

  worker.on("message", (buffer: ArrayBuffer) => {
    const arr = new Uint8Array(buffer);
    const msg = readMessage(arr);
    pong_time = process.hrtime(ping_time);
    printExecTime("ping-pong", pong_time);
    // console.log("got arr.len", arr.byteLength);
    recieved[i] = msg;
    i++;
    if (i < messages.length) {
      sendMsgBin(messages[i], arr);
      ping_time = process.hrtime();
    } else {
      worker.removeAllListeners("message");

      const hrend = process.hrtime(hrstart);

      printExecTime("binary", hrend);
      worker.terminate();
    }
  });
  sendMsgBin(messages[0], new Uint8Array(1024));
};

// const measureSharedArrayBuff = () => {
//   let i = 0;
//   const recieved: Msg[] = [];

// //   const sharedArr = new SharedArrayBuffer()
//   const hrstart = process.hrtime();

//   worker.on("message", (arr: ArrayBuffer) => {
//     const msg = readMessage(arr);
//     // console.log("read", msg);
//     recieved.push(msg);
//     i++;
//     if (i < messages.length) {
//       sendMsgBin(messages[i], arr);
//     } else {
//       worker.removeAllListeners("message");

//       const hrend = process.hrtime(hrstart);

//       const tookMs = hrend[1] / 1000000;

//       console.log(`binary: took ${tookMs}ms`);
//     }
//   });
//   sendMsgBin(messages[0], new Uint8Array(1024).buffer);
// };

measureJson();

// if (isMainThread) {
//   // This code is executed in the main thread and not in the worker.
//   // Create the worker.
// } else {
//   // This code is executed in the worker and not in the main thread.

//   // Send a message to the main thread.
//   parentPort!.postMessage("Hello world!" + JSON.stringify(genMessage(10)));
// }
