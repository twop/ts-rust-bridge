# ts-rust-bridge-codegen

Code generation library for efficient communication between rust and typescript.

# WIP

WARNING: The tool is far from being ready: not enough documentation + missing features. That said, you are welcome to take a look and give feedback.

## Install

`npm install ts-rust-bridge-codegen --save-dev`

If you want to use binary serialization/deserialization:

`npm install ts-binary --save`

## Goal

The goal of the this project is to provide a toolset to build efficient communication between rust and typescript.

## Example

Define AST(ish) structure in typescript. Note that it is a small subset of `serde` types from rust ecosystem.

```ts
import { EntryType, T, Variant as V } from 'ts-rust-bridge-codegen';

const Message = EntryType.Union(
  'Message',
  [
    V.Unit('Unit'),
    V.NewType('One', T.Scalar.F32),
    V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.F32]),
    V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
  ],
  // if are going to use bincode set to false, otherwise true
  // it regulates if the rust declaration should be annotated with
  // #[serde(tag = "tag", content = "value")]
  { tagAnnotation: false }
);
```

Then codegen typescript and rust:

```ts
import { schema2rust, schema2ts } from 'ts-rust-bridge-codegen';

const tsCode = schema2ts([Message]).join('\n\n');
const rustCode = schema2rust([Message]).join('\n\n');
```

And here is the result:

rust

```rust
#[derive(Deserialize, Debug, Clone)]
pub enum Message {
    Unit,
    One(f32),
    Two(Option<bool>, f32),
    VStruct { id: String, data: String },
}
```

typescript

```ts
export type Message =
  | { tag: 'Unit' }
  | { tag: 'One'; value: number }
  | { tag: 'Two'; value: Message_Two }
  | { tag: 'VStruct'; value: Message_VStruct };

export interface Message_Two {
  0: (boolean) | undefined;
  1: number;
  length: 2;
}

export interface Message_VStruct {
  id: string;
  data: string;
}

export module Message {
  export const Unit: Message = { tag: 'Unit' };

  export const One = (value: number): Message => ({ tag: 'One', value });

  export const Two = (p0: (boolean) | undefined, p1: number): Message => ({
    tag: 'Two',
    value: [p0, p1]
  });

  export const VStruct = (value: Message_VStruct): Message => ({
    tag: 'VStruct',
    value
  });
}
```

Now you can serialize them as JSON or as binary.

## Bincode

Now you can serialize your data structures to binary format called `bincode`! You can find more detail about the format here: https://github.com/TyOverby/bincode.

In short: it is a very efficient way to represent data structures that native to rust in a binary form.

### Why?

There are three potential usecases:

1. Communicate between typescript (js) and rust code. In case of our initial motivation project (https://github.com/cztomsik/stain) it is node -> rust native via `ffi` module.
2. Communicate between WebAssembly module written in rust and typecript (I hope I will make an example for it).
3. Communicate between WebWorker(ts/js) and main thread(ts/js). That's right, you can just use typescript serializers/deserializers without rust code :)

Any combination of the above: WASM module running in a WebWorker that talks to a rust backend? ^\_^

### How to generate code

Note: bincode serialization relies on read/write api to a Uint8Array provided by `ts-binary` package (it is located in the neighbor folder in this repo).
It is up to you how to make this package available to the generated code.

```ts
import {
  schema2ts,
  ast2ts,
  schema2serializers,
  schema2deserializers
} from 'ts-rust-bridge-codegen';

// our initial ast declaration file
import { Message } from './basic.ast';
import { format } from 'prettier';
import * as fs from 'fs';

const tsFile = __dirname + '/generated/basic.generated.ts';
const tsSerFile = __dirname + '/generated/basic.ser.generated.ts';
const tsDeserFile = __dirname + '/generated/basic.deser.generated.ts';

const tsContent = `
${schema2ts([Message]).join('\n\n')}
`;

const tsSerContent = `
${ast2ts(
  schema2serializers({
    entries: [Message],
    typesDeclarationFile: `./basic.generated`
  })
).join('\n\n')}
`;

const tsDeserContent = `
${ast2ts(
  schema2deserializers({
    entries: [Message],
    typesDeclarationFile: `./basic.generated`
  })
).join('\n\n')}
`;

// the output should be prettified. I tried my best but better use prettier :)
// note you can pass your own options
const pretty = (content: string) => format(content, { parser: 'typescript' });

fs.writeFileSync(tsFile, pretty(tsContent));
fs.writeFileSync(tsSerFile, pretty(tsSerContent));
fs.writeFileSync(tsDeserFile, pretty(tsDeserContent));
```

It will generate human readable serializers + deserializers.

Serializer:

```ts
import { Message, Message_Two, Message_VStruct } from './basic.generated';

import {
  write_u32,
  write_f32,
  opt_writer,
  write_bool,
  write_str,
  Sink,
  Serializer
} from 'ts-binary';

const writeOptBool: Serializer<(boolean) | undefined> = opt_writer(write_bool);

export const writeMessage = (sink: Sink, val: Message): Sink => {
  switch (val.tag) {
    case 'Unit':
      return write_u32(sink, 0);
    case 'One':
      return write_f32(write_u32(sink, 1), val.value);
    case 'Two':
      return writeMessage_Two(write_u32(sink, 2), val.value);
    case 'VStruct':
      return writeMessage_VStruct(write_u32(sink, 3), val.value);
  }
};

const writeMessage_Two = (sink: Sink, val: Message_Two): Sink =>
  write_u32(writeOptBool(sink, val[0]), val[1]);

const writeMessage_VStruct = (
  sink: Sink,
  { id, data }: Message_VStruct
): Sink => write_str(write_str(sink, id), data);
```

Deserializer:

```ts
import { Message, Message_VStruct } from './basic.generated';

import {
  read_u32,
  read_f32,
  opt_reader,
  read_bool,
  read_str,
  Sink,
  Deserializer
} from 'ts-binary';

const readOptBool: Deserializer<(boolean) | undefined> = opt_reader(read_bool);

export const readMessage = (sink: Sink): Message => {
  switch (read_u32(sink)) {
    case 0:
      return Message.Unit;
    case 1:
      return Message.One(read_f32(sink));
    case 2:
      return Message.Two(readOptBool(sink), read_u32(sink));
    case 3:
      return Message.VStruct(readMessage_VStruct(sink));
  }
  throw new Error('bad variant index for Message');
};

const readMessage_VStruct = (sink: Sink): Message_VStruct => {
  const id = read_str(sink);
  const data = read_str(sink);
  return { id, data };
};
```

### How to use it

```ts
import { Sink, Serializer, Deserializer } from 'ts-binary';

// file names are taken from the example
import { Message } from './generated/basic.generated';
import { writeMessage } from './generated/basic.ser.generated';
import { readMessage } from './generated/basic.deser.generated';

let sink: Sink = {
  arr: new Uint8Array(1), // automatically resizes if needed
  pos: 0
};

// just write to a buffer and return it
const writeAThing = <T>(thing: T, ser: Serializer<T>): Uint8Array => {
  sink.pos = 0;
  sink = ser(sink, thing);
  return sink.arr;
};

// create a new reader sink and read from the beginning
const readAThing = <T>(arr: Uint8Array, deser: Deserializer<T>): T =>
  deser({ pos: 0, arr });

const msg = Message.VStruct({ id: 'some id', data: 'some data' });

const bytes = writeAThing(msg, writeMessage);
const restoredMessage = readAThing(bytes, readMessage);

console.log(
  `are equals = ${JSON.stringify(msg) ===
    JSON.stringify(restoredMessage)}, json =`,
  JSON.stringify(msg)
);
// are equals = true, json = {"tag":"VStruct","value":{"id":"some id","data":"some data"}}
```

Look at [examples](https://github.com/twop/ts-rust-bridge/tree/master/packages/ts-rust-bridge-codegen/examples) dir for more information how to use the library.

## Simple benchmarks

I just copypasted generated code from examples and tried to construct a simple benchmark.

Code
https://stackblitz.com/edit/ts-binaray-benchmark?file=index.ts

Version to try
https://ts-binaray-benchmark.stackblitz.io

On complex data structure:

| Method    | Serialization | Deserialization |
| --------- | :-----------: | --------------: |
| ts-binary |     74 ms     |           91 ms |
| JSON      |    641 ms     |          405 ms |

Simple data structure:

| Method    | Serialization | Deserialization |
| --------- | :-----------: | --------------: |
| ts-binary |     2 ms      |            1 ms |
| JSON      |     6 ms      |            5 ms |

That was measured on latest Safari version.

Note you can run the benchmark yourself cloning the repo + running npm scripts

## License

MIT
