import { Message, Container, Figure, Color, Vec3 } from './generated/simple.g';
import { Serializer, Sink, Deserializer } from '../../ts-binary/src/index';
import {
  readMessage,
  readContainer,
  writeMessage,
  writeContainer
} from './generated/simple_serde.g';
import * as fs from 'fs';

const L = console.log;
const measure = (name: string, func: () => void) => {
  //log(`\n${' '.repeat(4)}${name}`);

  // let fastest = 100500;

  const numberOfRuns = 4;
  const takeTop = 1;

  let runs: number[] = [];
  for (let i = 0; i < numberOfRuns; i++) {
    const hrstart = process.hrtime();
    func();
    const hrend = process.hrtime(hrstart);

    const current = hrend[1] / 1000000;

    runs.push(current);

    // fastest = Math.min(fastest, current);
  }

  const result = runs
    .sort((a, b) => a - b)
    .slice(numberOfRuns - takeTop, numberOfRuns)
    .reduce((s, v) => s + v, 0);

  L(`${name}: ${result.toFixed(2)} ms`);
};

const COUNT = 10000;

function randomStr(length: number): string {
  var text = '';
  var possible = 'ываыафяДЛОАВЫЛОАВУКЦДЛСВЫФзвфыджл0123456789';

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

const ctors: (() => Message)[] = [
  () => Message.Unit,
  () => Message.One(Math.random() * 10000),
  () =>
    Message.Two(
      Math.random() > 0.5 ? undefined : Math.random() > 0.5,
      Math.floor(Math.random() * 1000)
    ),
  () =>
    Message.Two(
      Math.random() > 0.5 ? undefined : Math.random() > 0.5,
      Math.floor(Math.random() * 1000)
    ),
  () =>
    Message.VStruct({
      id: randomStr(Math.random() * 20),
      data: randomStr(Math.random() * 20)
    })
];

const genArray = <T>(f: () => T): T[] =>
  Array.from({ length: Math.floor(Math.random() * 30) }, f);

const randu8 = () => Math.floor(Math.random() * 256);
const randf32 = () => Math.random() * 1000;

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

type Data = {
  len: number;
  containers: Container[];
  messages: Message[];
};

const genData = (): Data => ({
  containers: Array.from({ length: COUNT }, genContainer),
  len: COUNT,
  messages: Array.from(
    { length: COUNT },
    // () => ctors[4]()
    () => ctors[Math.floor(Math.random() * 4)]()
  )
});
let data: Data | undefined = undefined;

try {
  data = JSON.parse(fs.readFileSync('bench_data.json').toString());
  if (data!.len !== COUNT) {
    data = undefined;
  }
} catch {}

if (!data) {
  data = genData();
  L('regenerated data');
  fs.writeFileSync('bench_data.json', JSON.stringify(data));
} else {
  L('data read from cache');
}

const { messages, containers } = data;
// fs.writeFileSync();

// let sink: Sink = {
//   arr: new Uint8Array(1000),
//   pos: 0
// };
let sink = Sink(new ArrayBuffer(2000));

const writeAThingToNothing = <T>(thing: T, ser: Serializer<T>): void => {
  sink.pos = 0;
  sink = ser(sink, thing);
};

const writeAThingToSlice = <T>(thing: T, ser: Serializer<T>): ArrayBuffer => {
  const s = ser(Sink(new ArrayBuffer(1000)), thing);
  // const slice = new Uint8Array(s.arr.buffer).slice(0, s.pos).buffer;
  const slice = new Uint8Array(s.view.buffer).slice(0, s.pos).buffer;

  // if (s.arr.buffer === slice) {
  if (s.view.buffer === slice) {
    throw new Error('Aha!');
  }

  return slice;
};

runbench('containers', containers, writeContainer, readContainer);
runbench('messages', messages, writeMessage, readMessage);

containers;
readContainer;
writeContainer;

function runbench<T>(
  benchName: string,
  data: T[],
  serialize: Serializer<T>,
  deserialize: Deserializer<T>
) {
  L('                      ');
  L(benchName.toUpperCase());
  L('----Serialization----');
  measure('just bincode', () => {
    data.forEach(d => writeAThingToNothing(d, serialize));
  });

  measure('json', () => {
    data.forEach(d => JSON.stringify(d));
  });
  L('----Deserialization----');

  const sinks = data.map(d => Sink(writeAThingToSlice(d, serialize)));

  sinks.forEach(s => {
    if (s.pos !== 0) {
      throw 'a';
    }
  });
  const strings = data.map(d => JSON.stringify(d));

  const res = [...data]; // just a copy

  measure('D: bincode', () => {
    sinks.forEach((s, i) => {
      //   if (s.pos !== 0) {
      //     throw 'b';
      //   }
      // if (i === 0) L('!!', i, s.pos, s.view.buffer.byteLength);
      s.pos = 0;
      res[i] = deserialize(s);
    });
  });

  // res.forEach((d, i) => {
  //   if (JSON.stringify(d) !== strings[i]) {
  //     console.error('mismatch', {
  //       expected: strings[i],
  //       actual: JSON.stringify(d)
  //     });
  //   }
  // });

  measure('D: json', () => {
    strings.forEach((s, i) => (res[i] = JSON.parse(s)));
  });
}
// }, 1000 * 20);
