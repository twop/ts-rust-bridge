import {
  writeMessage,
  writeMyEnum,
  writeNormalStruct,
  readMessage,
  readMyEnum,
  readNormalStruct
} from './generated/simple_serde.g';
import {
  Sink,
  Serializer,
  write_str,
  Deserializer
} from '../../ts-binary/src/index';

import { NormalStruct, Message, MyEnum, MyTuple } from './generated/simple.g';

let sink = Sink(new ArrayBuffer(100));

const writeAThing = <T>(thing: T, ser: Serializer<T>): Uint8Array => {
  sink.pos = 0;
  sink = ser(sink, thing);
  return new Uint8Array(sink.view.buffer).slice(0, sink.pos);
};

const readAThing = <T>(arr: ArrayBuffer, deser: Deserializer<T>): T =>
  deser(Sink(arr));

const str = 'AnotherUnit';
console.log('tag', JSON.stringify(str), writeAThing(str, write_str));

// const msg = Message.One(7);
// [3, 0, 0, 0, 0, 0, 0, 0, 84, 119, 111, 1, 1, 7, 0, 0, 0]
// [ 3, 0, 0, 0, 1, 1, 7, 0, 0, 0 ]
// [ 3, 0, 0, 0, 1, 1, 7, 0, 0, 0 ]
const msg = Message.VStruct({ id: 'some id', data: 'some data' });

// with tag [11, 0, 0, 0, 0, 0, 0, 0, 65, 110, 111, 116, 104, 101, 114, 85, 110, 105, 116]
// no tag [ 1, 0, 0, 0 ]
// const msg = Message.AnotherUnit;

const bytes = writeAThing(msg, writeMessage);
const restoredMessage = readAThing(bytes.buffer, readMessage);

console.log(
  `are equals = ${JSON.stringify(msg) ===
    JSON.stringify(restoredMessage)}, json =`,
  JSON.stringify(msg)
);

const en = MyEnum.ONE;
console.log('enum', JSON.stringify(en), writeAThing(en, writeMyEnum));
console.log('D: enum', readAThing(sink.view.buffer, readMyEnum));

const struct: NormalStruct = { a: 13, tuple: MyTuple(true, ['ab', 'c']) };
console.log(
  'struct',
  JSON.stringify(struct),
  writeAThing(struct, writeNormalStruct)
);
console.log('D: struct', readAThing(sink.view.buffer, readNormalStruct));
