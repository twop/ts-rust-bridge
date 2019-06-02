import {
  Message,
  Container,
  Figure,
  Color,
  Vec3
} from './generated/basic.generated';
import { Serializer, Sink, Deserializer } from '../../ts-binary/src';
import { writeMessage, writeContainer } from './generated/basic.ser.generated';
import { readMessage, readContainer } from './generated/basic.deser.generated';

const log = console.log;
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

  log(`${name}: ${result.toFixed(2)} ms`);
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

const messages: Message[] = Array.from(
  { length: COUNT },
  // () => ctors[4]()
  () => ctors[Math.floor(Math.random() * 4)]()
);

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

const containers: Container[] = Array.from({ length: COUNT }, genContainer);

let sink: Sink = {
  arr: new Uint8Array(1000),
  pos: 0
};

const writeAThingToNothing = <T>(thing: T, ser: Serializer<T>): void => {
  sink.pos = 0;
  sink = ser(sink, thing);
};

const writeAThingToSlice = <T>(thing: T, ser: Serializer<T>): Uint8Array => {
  sink.pos = 0;
  sink = ser(sink, thing);
  return sink.arr.slice(0, sink.pos);
};

runbench('containers', containers, writeContainer, readContainer);
runbench('messages', messages, writeMessage, readMessage);

containers;
readContainer;
writeContainer;

function runbench<T>(
  benchName: string,
  data: T[],
  serFun: Serializer<T>,
  deserializer: Deserializer<T>
) {
  setTimeout(() => {
    log('                      ');
    log(benchName.toUpperCase());
    log('----Serialization----');
    measure('just bincode', () => {
      data.forEach(d => writeAThingToNothing(d, serFun));
    });
    measure('bincode + slicing', () => {
      data.forEach(d => writeAThingToSlice(d, serFun));
    });
    measure('json', () => {
      data.forEach(d => JSON.stringify(d));
    });
    log('----Deserialization----');

    const buffers = data.map(d => writeAThingToSlice(d, serFun));
    const strings = data.map(d => JSON.stringify(d));

    const res = [...data]; // just a copy

    measure('D: bincode', () => {
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

    measure('D: json', () => {
      strings.forEach((s, i) => (res[i] = JSON.parse(s)));
    });
  });
}
// }, 1000 * 20);
