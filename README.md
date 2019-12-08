# ts-rust-bridge

A collection of libraries for efficient communication between rust and typescript ( + other languages in the future).

The project is structure as a monorepo. Look at the docs for each to find more details:

Code generation library: [ts-rust-bridge-codegen](https://github.com/twop/ts-rust-bridge/tree/master/packages/ts-rust-bridge-codegen)

Utilities to serialize/deserialize data in binary form: [ts-binary](https://github.com/twop/ts-rust-bridge/tree/master/packages/ts-binary)

# WIP

WARNING: The tool is far from being ready: not enough documentation + missing features. That said, you are welcome to take a look and give feedback.

## Install

`npm install ts-rust-bridge-codegen --save-dev`

If you want to use binary serialization/deserialization:

`npm install ts-binary --save`

## Example

Define AST(ish) structure in typescript. Note that it is a small subset of `serde` types from rust ecosystem.

```ts
import { Type } from "ts-rust-bridge-codegen";

const { Enum, Struct, Str, F32 } = Type;

const Size = Enum("S", "M", "L");
const Shirt = Struct({ size: Size, color: Str, price: F32 });
const schema = { Size, Shirt };
```

Then codegen typescript and rust:

```ts
import { schema2rust, schema2ts } from "ts-rust-bridge-codegen";

const tsCode = schema2ts(schema).join("\n\n");

const rustCode = `
use serde::{Deserialize, Serialize};

${schema2rust(schema).join("\n")}
`;
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
  S = "S",
  M = "M",
  L = "L"
}
```

## How to use it

You can use `ts-rust-bridge-codegen` as a standalone tool. It is designed to be run manually or build time, so it should be a dev dependency.

What it can do:

1. Define a type schema that can be used to generate typescript and/or rust type definitions.
2. After that you can just use JSON as a format to communicate between the two runtimes.

If you want to be more efficient than JSON (it is CPU + memory intensive) you can use a binary serialization format compatible with [bincode](https://github.com/TyOverby/bincode)

3. Generate binary type serializers/deserializers based on the schema.
4. Profit!

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
