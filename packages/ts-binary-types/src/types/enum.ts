import { Sink, read_u32, Serializer, write_u32 } from "ts-binary";
import { BinType, createBinType, TypeTag } from "../core";

type Variants<V extends string[]> = { [K in V[number]]: K };

interface EnumBinType<V extends string[]>
  extends BinType<TypeTag.Enum, V[number], { variants: V }> {}

export type Enum<V extends string[]> = EnumBinType<V> & Variants<V>;

export const Enum = <V extends string[]>(
  ...variants: V
): Enum<V> & Variants<V> =>
  createBinType<Enum<V>>(
    (sink: Sink) => variants[read_u32(sink)],
    createEnumSerializer(variants),
    TypeTag.Enum,
    { variants } as any,
    variants.reduce((map, variant) => ({ ...map, [variant]: variant }), {} as {
      [key: string]: string;
    }) as any
  );

const createEnumSerializer = <V extends string[]>(
  variants: V
): Serializer<V[number]> => {
  const valToIndex = variants.reduce(
    (map, v, i) => ({ ...map, [v]: i }),
    {} as { [key: string]: number }
  );

  return (sink: Sink, val) => write_u32(sink, valToIndex[val]);
};
