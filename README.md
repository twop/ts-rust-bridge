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
import { EntryType, T, Variant as V } from "ts-rust-bridge-codegen";

const Message = EntryType.Union(
  "Message",
  [
    V.Unit("Unit"),
    V.NewType("One", T.Scalar.F32),
    V.Tuple("Two", [T.Option(T.Scalar.Bool), T.Scalar.F32]),
    V.Struct("VStruct", { id: T.Scalar.Str, data: T.Scalar.Str })
  ],
  // needed to switch between json or binary format
  { tagAnnotation: false }
);
```

Then codegen typescript and rust:

```ts
import { schema2rust, schema2ts } from "ts-rust-bridge-codegen";

const tsCode = schema2ts([Message]).join("\n\n");
const rustCode = schema2rust([Message]).join("\n\n");
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
  | { tag: "Unit" }
  | { tag: "One"; value: number }
  | { tag: "Two"; value: Message_Two }
  | { tag: "VStruct"; value: Message_VStruct };

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
  export const Unit: Message = { tag: "Unit" };

  export const One = (value: number): Message => ({ tag: "One", value });

  export const Two = (p0: (boolean) | undefined, p1: number): Message => ({
    tag: "Two",
    value: [p0, p1]
  });

  export const VStruct = (value: Message_VStruct): Message => ({
    tag: "VStruct",
    value
  });
}
```

## What you can do

You can use `ts-rust-bridge-codegen` as a standalone tool. It is designed to be run manually or build time, so it should be a dev dependency.

What it can do:

1. Define a data structure schema that can be used to generate typescript and/or rust type definitions.
2. After that you can just use JSON as a format to communicate between the two runtimes.

If you want to be more efficient than JSON (it is CPU + memory intensive) you can use a binary serialization format based on: [bincode](https://github.com/TyOverby/bincode)

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
