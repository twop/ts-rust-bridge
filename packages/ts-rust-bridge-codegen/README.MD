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

Define schema in typescript DSL (Domain specific language). Note that it is a small subset of `serde` types from rust ecosystem.

```ts
import { schema2ts, schema2rust, Type } from 'ts-rust-bridge-codegen';
import * as fs from 'fs';

const { Enum, Struct, Str, F32 } = Type;

const Size = Enum('S', 'M', 'L');
const Shirt = Struct({ size: Size, color: Str, price: F32 });
const schema = { Size, Shirt };

const tsCode = schema2ts(schema).join('\n\n');

const rustCode = `
use serde::{Deserialize, Serialize};

${schema2rust(schema).join('\n')}
`;

// save to disc
fs.writeFileSync('schema.ts', tsCode);
fs.writeFileSync('schema.rs', rustCode);
```

And here is the result:

rust

```rust
// schema.rs
use serde::{Deserialize, Serialize};
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Shirt {
    pub size: Size,
    pub color: String,
    pub price: f32,
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum Size {
    S,
    M,
    L,
}
```

typescript

```ts
// schema.ts after prettier
export interface Shirt {
  size: Size;
  color: string;
  price: number;
}

export enum Size {
  S = 'S',
  M = 'M',
  L = 'L'
}
```

Now you can serialize them as JSON or as binary.

## Bincode

Now you can serialize your data structures to binary format called `bincode`! You can find more detail about the format here: https://github.com/servo/bincode.

In short: it is a very efficient way to represent data structures that native to rust in a binary form.

### Why?

There are three potential usecases:

1. Communicate between typescript (js) and rust code. In case of our initial motivation project (https://github.com/cztomsik/stain) it is node -> rust native via `ffi` module.
2. Communicate between WebAssembly module written in rust and typecript.
3. Communicate between WebWorker(ts/js) and main thread(ts/js). That's right, you can just use typescript serializers/deserializers without rust code :)

Any combination of the above: WASM module running in a WebWorker that talks to a rust backend? ^\_^

### How to generate code serializers/deserializers for typescript

Note: bincode serialization relies on read/write api to a ArrayBuffer provided by `ts-binary` package (it is located in the neighbor folder in this repo).

```ts
import {
  schema2ts,
  schema2rust,
  schema2serde,
  Type
} from 'ts-rust-bridge-codegen';
import * as fs from 'fs';

const { Enum, Struct, Str, F32 } = Type;

const Size = Enum('S', 'M', 'L');
const Shirt = Struct({ size: Size, color: Str, price: F32 });
const schema = { Size, Shirt };

const tsCode = schema2ts(schema).join('\n\n');

const rustCode = `
use serde::{Deserialize, Serialize};

${schema2rust(schema).join('\n')}
`;

const tsSerDeCode = `
${schema2serde({
  schema: schema,
  typesDeclarationFile: `./schema`
}).join('\n\n')}
`;

// save to disc
fs.writeFileSync('schema.ts', tsCode);
fs.writeFileSync('schema.rs', rustCode);
fs.writeFileSync('schema_serde.ts', tsSerDeCode);
```

In addition to type definitions files it will generate human readable serializers + deserializers.

```ts
// schema_serde.ts after prettier
import { Size, Shirt } from './schema';

import {
  write_u32,
  write_str,
  write_f32,
  Sink,
  read_u32,
  read_str,
  read_f32
} from 'ts-binary';

// Serializers

const SizeMap: { [key: string]: number } = { S: 0, M: 1, L: 2 };

export const writeSize = (sink: Sink, val: Size): Sink =>
  write_u32(sink, SizeMap[val]);

export const writeShirt = (sink: Sink, { size, color, price }: Shirt): Sink =>
  write_f32(write_str(writeSize(sink, size), color), price);

// Deserializers

const SizeReverseMap: Size[] = [Size.S, Size.M, Size.L];

export const readSize = (sink: Sink): Size => SizeReverseMap[read_u32(sink)];

export const readShirt = (sink: Sink): Shirt => {
  const size = readSize(sink);
  const color = read_str(sink);
  const price = read_f32(sink);
  return { size, color, price };
};
```

### How to use it

```ts
// usage.ts
import { writeShirt, readShirt } from './schema_serde';
import { Shirt, Size } from './schema';
import { Sink } from 'ts-binary';

const shirt: Shirt = { color: 'red', price: 10, size: Size.L };

let sink = writeShirt(Sink(new ArrayBuffer(100)), shirt);

console.log('bytes:', new Uint8Array(sink.view.buffer, 0, sink.pos));
// bytes: Uint8Array
// [
// 2, 0, 0, 0,             <-- Size.L
// 3, 0, 0, 0, 0, 0, 0, 0, <- number of bytes for 'red' in utf-8
// 114, 101, 100,          <-- 'r', 'e', 'd'
// 0, 0, 32, 65            <-- 10 as float 32 byte representation
// ]

// reset pos to read value back
sink.pos = 0;
const restoredShirt = readShirt(sink);
console.log('restored:', restoredShirt);
// restored: { size: 'L', color: 'red', price: 10 }
```

Look at [examples](https://github.com/twop/ts-rust-bridge/tree/master/packages/ts-rust-bridge-codegen/examples) dir for more information how to use the library.

## API

TODO.

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
