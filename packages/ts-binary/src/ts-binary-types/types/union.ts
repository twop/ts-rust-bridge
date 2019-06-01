import { Static, BinType, createBinType, bindesc, TypeTag } from '../core';
import { Serializer, write_u32, Sink, Deserializer, read_u32 } from '../..';
// import { Tuple2, Tuple3 } from './tuple';

// type VariantDef = Runtype<any> | null | Inline<any>;
type VariantDefs = { [_: string]: BinType<any> | null };

// type Inline<T extends Tuple2<any, any> | Tuple3<any, any, any>> = {
//   inlined: 'tuple';
//   tuple: T;
// };

// export const inline = <T extends Tuple2<any, any> | Tuple3<any, any, any>>(
//   tuple: T
// ): Inline<T> => ({ tuple, inlined: 'tuple' });

export interface Tagged<Val, T extends string | number | symbol> {
  tag: T;
  val: Val;
}

export interface ConstTag<T extends string | number | symbol> {
  tag: T;
}

type Unify<Record extends VariantDefs> = {
  [K in keyof Record]: null extends Record[K]
    ? ConstTag<K>
    : Record[K] extends BinType<any, any, any>
    ? Tagged<Static<Record[K]>, K> //{  tag: K; val: Static<Record[K]> }
    : never
};

type Contsructors<V extends VariantDefs> = {
  [K in keyof V]: null extends V[K]
    ? UnionVal<V>
    : V[K] extends BinType<any, any, any>
    ? (val: Static<V[K]>) => UnionVal<V>
    : never
};

type JustValues<
  TaggedRecord extends { [_: string]: any }
> = TaggedRecord[keyof TaggedRecord];

type UnionVal<V extends VariantDefs> = JustValues<Unify<V>>;

interface UnionRuntype<V extends VariantDefs>
  extends BinType<TypeTag.Union, UnionVal<V>, { variants: V }> {}

export type Union<V extends VariantDefs> = UnionRuntype<V> & Contsructors<V>;

// TODO have a little more typesafety than 5 `as any` out of 5
export const Union = <V extends VariantDefs>(variants: V): Union<V> =>
  createBinType<Union<V>>(
    createUnionDeserializer(variants) as any,
    createUnionSerializer(variants),
    TypeTag.Union as any,
    { variants } as any,
    createUnionConstructors(variants) as any
  );

const createUnionSerializer = <V extends VariantDefs>(
  variants: V
): Serializer<UnionVal<V>> => {
  const keys = Object.keys(variants);

  const serializersMap = keys.reduce(
    (m, key, i) => {
      const variantType = variants[key];

      if (variantType === null) {
        return {
          ...m,
          [key]: (sink: Sink) => write_u32(sink, i)
        };
      }

      const serializer = variantType[bindesc].write;
      return {
        ...m,
        [key]: (sink: Sink, val: any) => serializer(write_u32(sink, i), val)
      };
    },
    {} as {
      [key: string]: Serializer<any>;
    }
  );

  return ((sink: Sink, { tag, val }: { tag: string; val: any }) =>
    serializersMap[tag](sink, val)) as any;
};

const createUnionDeserializer = <V extends VariantDefs>(
  variants: V
): Deserializer<UnionVal<V>> => {
  const keys = Object.keys(variants);

  const deserializers = keys.map(key => {
    const variantType = variants[key];
    return variantType && variantType[bindesc].read;
  });

  const unitValues = keys.map(key => {
    const runtype = variants[key];
    return runtype ? null : { tag: key };
  });

  return (sink: Sink): any => {
    const index = read_u32(sink);
    const deserializer = deserializers[index];
    const tag = keys[index];
    return deserializer ? { tag, val: deserializer(sink) } : unitValues[index];
  };
};

const createUnionConstructors = <V extends VariantDefs>(
  variants: V
): Contsructors<V> =>
  Object.keys(variants).reduce(
    (map, tag) => {
      const typeDef = variants[tag];
      (map as any)[tag] =
        typeDef === null ? { tag } : (val: any) => ({ tag, val });
      return map;
    },
    {} as Contsructors<V>
  );
