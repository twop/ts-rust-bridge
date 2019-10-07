import { Message, Container, Figure, Color, Vec3 } from "./tes-types";
import { Serializer, Sink, Deserializer } from "ts-binary";
import { bindesc } from "../core";
// import { bintypeToBinAst, binAst2bintype } from "./traverse";
// import { writeMessage, writeContainer } from "./ser";
// import { readMessage, readContainer } from "./deser";

let logged: any[] = [];
const log = (...args: any[]) => {
  logged.push(args);
  console.log(...args);
};

const bench = () => {
  const measure = (name: string, func: () => void) => {
    //log(`\n${' '.repeat(4)}${name}`);

    // let fastest = 100500;

    const numberOfRuns = 1;
    const takeTop = 1;

    let runs: number[] = [];
    for (let i = 0; i < numberOfRuns; i++) {
      const hrstart = Date.now();
      func();
      const hrend = Date.now();

      const current = hrend - hrstart;

      runs.push(current);

      // fastest = Math.min(fastest, current);
    }

    const result = runs
      .sort((a, b) => a - b)
      .slice(numberOfRuns - takeTop, numberOfRuns)
      .reduce((s, v) => s + v, 0);

    log(`${name}: ${result.toFixed(2)} ms`);
  };

  const COUNT = 50000;

  function randStr(length: number): string {
    var text = "";
    var possible = "выфвпаывпцукждслчмДЛОДЛТДЛОЖЖЩШЛДЙТЦУЗЧЖСДЛ12389050-5435";
    // 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }

  const randu8 = () => Math.floor(Math.random() * 256);
  const randi32 = () =>
    Math.floor(Math.random() * 1000) * (randBool() ? 1 : -1);
  const randf32 = () => Math.random() * 1000;
  const randBool = () => Math.random() > 0.5;

  const ctors: (() => Message)[] = [
    () => Message.Unit,
    () => Message.One(Math.random() * 10000),
    () =>
      Message.Two([
        Math.random() > 0.5 ? undefined : Math.random() > 0.5,
        Math.floor(Math.random() * 1000)
      ]),

    () =>
      Message.VStruct({
        id: randStr(Math.random() * 300),
        data: randStr(Math.random() * 300)
      }),
    () =>
      Message.SmallStruct({
        bool: randBool(),
        f64: randf32(),
        maybeI32: randBool() ? undefined : randi32()
      })
  ];
  log("----Simple(START)---");
  const messages: Message[] = Array.from(
    { length: COUNT },
    // () => ctors[2]()
    () => ctors[3]() // strings
    // () => ctors[4]()
    // () => ctors[Math.floor(Math.random() * 5)]()
  );
  log("----Simple(END)---");

  const genArray = <T>(f: () => T): T[] =>
    Array.from({ length: Math.floor(Math.random() * 30) }, f);

  const genColor = (): Color => Color(randu8(), randu8(), randu8());
  const genVec3 = (): Vec3 => Vec3(randf32(), randf32(), randf32());

  const genFigure = (): Figure => ({
    dots: genArray(genVec3),
    colors: genArray(genColor)
  });

  const genContainer = (): Container => {
    const seed = Math.random();

    return seed < 0.33
      ? Container.Units
      : seed < 0.66
      ? Container.JustNumber(randu8())
      : Container.Figures(genArray(genFigure));
  };

  log("----Complex(START)---");
  const containers: Container[] = Array.from({ length: COUNT }, genContainer);
  log("----Complex(END)----");
  containers;

  let sink: Sink = {
    arr: new Uint8Array(1000),
    pos: 0
  };

  // const writeAThingToNothing = <T>(thing: T, ser: Serializer<T>): void => {
  //   sink.pos = 0;
  //   sink = ser(sink, thing);
  // };

  const writeAThingToSlice = <T>(thing: T, ser: Serializer<T>): Uint8Array => {
    sink.pos = 0;
    sink = ser(sink, thing);
    return sink.arr.slice(0, sink.pos);
  };

  function runbench<T>(
    benchName: string,
    data: T[],
    serFun: Serializer<T>,
    deserializer: Deserializer<T>
  ) {
    const strings = Array.from({ length: COUNT }, () => "");

    log("                      ");
    log(benchName.toUpperCase());
    log("----Serialization----");
    // measure("bincode + allocating a new buf", () => {
    //   data.forEach(d => writeAThingToSlice(d, serFun));
    // });
    measure("json", () => {
      data.forEach((d, i) => (strings[i] = JSON.stringify(d)));
    });

    const buffers = data.map(d => writeAThingToSlice(d, serFun));
    // data.map(d => writeAThingToSlice(d, serFun));
    measure("bincode", () => {
      // data.map(d => writeAThingToSlice(d, serFun));
      // const buffers = data.map(d => writeAThingToSlice(d, serFun));
      data.forEach((d, i) => (buffers[i] = writeAThingToSlice(d, serFun)));
    });

    const res = [...data]; // just a copy

    log("----Deserialization----");
    measure("D: bincode", () => {
      buffers.forEach((b, i) => (res[i] = deserializer({ arr: b, pos: 0 })));
    });

    // res.forEach((d, i) => {
    //   if (JSON.stringify(d) !== strings[i]) {
    //     console.error('mismatch', {
    //       expected: strings[i],
    //       actual: JSON.stringify(d)
    //     });
    //   }
    // });

    measure("D: json", () => {
      strings.forEach((s, i) => (res[i] = JSON.parse(s)));
    });
  }
  // }, 1000 * 20);

  // runbench(
  //   'complex',
  //   containers,
  //   Container[runtype].write,
  //   Container[runtype].read
  // );
  runbench("simple", messages, Message[bindesc].write, Message[bindesc].read);
};

export const runBench = (): string[] => {
  bench();
  const res = logged;
  logged = [];

  return res;
};

runBench();

// console.log(bintypeToBinAst(Message));
// console.log(bintypeToBinAst(Container));

// const messageAst = bintypeToBinAst(Message);
// const messageRestoredBintype = binAst2bintype(messageAst);

// const msg = Message.VStruct({ id: "id", data: "агф1!" });

// const serialize = <T>(thing: T, ser: Serializer<T>): Uint8Array => {
//   let sink: Sink = {
//     arr: new Uint8Array(1), // small on purpose
//     pos: 0
//   };

//   sink = ser(sink, thing);
//   return sink.arr.slice(0, sink.pos);
// };

// const restore = <T>(deserializer: Deserializer<T>, from: Uint8Array): T =>
//   deserializer({ arr: from, pos: 0 });

// console.log(msg);
// console.log(
//   restore(
//     messageRestoredBintype[bindesc].read,
//     serialize(msg, Message[bindesc].write)
//   )
// );

// console.log(runBench());

// res.innerHTML = logged.map(i => `<p>${i.toString()}</p>`).join("");
// const res = document.createElement("div");
// // Write TypeScript code!
// const appDiv: HTMLElement = document.getElementById("app");

// const btn = document.createElement("button");
// btn.textContent = "start";
// btn.onclick = run;
// appDiv.appendChild(btn);
// appDiv.appendChild(res);
