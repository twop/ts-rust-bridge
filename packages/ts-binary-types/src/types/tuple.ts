import {
  BinType,
  Static,
  bindesc,
  createBinType,
  TypeTag,
  AnyBinType
} from "../core";
import { Serializer, Deserializer } from "ts-binary";

type ValuesOf<C extends [AnyBinType, AnyBinType, ...AnyBinType[]]> = {
  [K in keyof C]: C[K] extends AnyBinType ? Static<C[K]> : C[K]
};

export interface Tuple<C extends [AnyBinType, AnyBinType, ...AnyBinType[]]>
  extends BinType<TypeTag.Tuple, ValuesOf<C>, { components: C }> {
  (...t: ValuesOf<C>): ValuesOf<C>;
}

export interface RTuple<
  C extends [AnyBinType, AnyBinType, ...AnyBinType[]],
  Alias
> extends BinType<TypeTag.Tuple, Alias, { components: C }> {
  (...t: ValuesOf<C>): Alias;
}

export function Tuple<C extends [AnyBinType, AnyBinType, ...AnyBinType[]]>(
  ...c: C
): Tuple<C> {
  let ctor: (...args: any[]) => any;

  const components = c;
  const serializers = components.map(c => c[bindesc].write);
  const deserializers = components.map(c => c[bindesc].read);

  let write: Serializer<ValuesOf<C>> | undefined;
  let read: Deserializer<ValuesOf<C>> | undefined;

  switch (components.length) {
    case 2: {
      ctor = (a, b) => ([a, b] as unknown) as ValuesOf<C>;

      const [s0, s1] = serializers;
      write = (sink, [a, b]) => s1(s0(sink, a), b);

      const [d0, d1] = deserializers;
      read = sink => ctor(d0(sink), d1(sink));
      break;
    }
    case 3: {
      ctor = (a, b, c) => ([a, b, c] as unknown) as ValuesOf<C>;

      const [s0, s1, s2] = serializers;
      write = (sink, [a, b, c]) => s2(s1(s0(sink, a), b), c);

      const [d0, d1, d2] = deserializers;
      read = sink => ctor(d0(sink), d1(sink), d2(sink));
      break;
    }
    default: {
      ctor = (...args) => args;

      write = (sink, tuple) =>
        tuple.reduce((s, val, i) => serializers[i](s, val), sink);

      read = sink => deserializers.map(d => d(sink)) as any;
      break;
    }
  }

  return createBinType(read, write, TypeTag.Tuple, { components }, ctor);
}
