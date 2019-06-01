import { BinType, Static, createBinType, bindesc, TypeTag } from '../core';
import { Serializer, Sink, Deserializer } from '../..';

type StructDefs = { [_: string]: BinType<any> };

type StructStaticType<SD extends StructDefs> = {
  [K in keyof SD]: Static<SD[K]>
};

export interface Struct<Fields extends StructDefs>
  extends BinType<
    TypeTag.Struct,
    StructStaticType<Fields>,
    { fields: Fields }
  > {}

export interface RStruct<Fields extends StructDefs, Alias>
  extends BinType<TypeTag.Struct, Alias, { fields: Fields }> {}

export const Struct = <Fields extends StructDefs>(
  fields: Fields
): Struct<Fields> =>
  createBinType<Struct<Fields>>(
    createStructDeserializer(fields),
    createStructSerializer(fields),
    TypeTag.Struct,
    { fields },
    {}
  );

const createStructSerializer = <O extends StructDefs>(
  fields: O
): Serializer<StructStaticType<O>> => {
  return Object.keys(fields)
    .map(k => ({ k, w: fields[k][bindesc].write }))
    .reduce<Serializer<StructStaticType<O>>>(
      (ser, { k, w }) => writeField(r => r[k], w, ser),
      (s, _) => s
    );
};

const writeField = <Rec, A>(
  getA: (r: Rec) => A,
  serA: Serializer<A>,
  ser: Serializer<Rec>
): Serializer<Rec> => {
  return (sink: Sink, r: Rec) => serA(ser(sink, r), getA(r));
};

const createStructDeserializer = <O extends StructDefs>(
  fields: O
): Deserializer<StructStaticType<O>> => {
  const keys = Object.keys(fields);
  const deserializers = keys.map(k => fields[k][bindesc].read);

  return (sink: Sink) => {
    const rec: Partial<StructStaticType<O>> = {};

    for (let i = 0; i < keys.length; i++) {
      rec[keys[i]] = deserializers[i](sink);
    }

    return rec as any;
  };
};
