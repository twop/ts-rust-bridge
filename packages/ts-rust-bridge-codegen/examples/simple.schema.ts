import { Type } from '../src/schema';

const {
  Alias,
  Enum,
  Tuple,
  Struct,
  Union,
  Newtype,
  Vec,
  Str,
  Bool,
  Option,
  F32,
  U8,
  U32
} = Type;

export const MyEnum = Enum('ONE', 'TWO', 'THREE');

const MyTuple = Tuple(Option(Bool), Vec(Str));

const NormalStruct = Struct({
  a: U8,
  tuple: MyTuple
});

const Message = Union({
  Unit: null,
  One: F32,
  Two: [Option(Bool), U32],
  VStruct: { id: Str, data: Str }
});

const Vec3 = Tuple(F32, F32, F32);
const Color = Tuple(U8, U8, U8);
const Figure = Struct({ dots: Vec(Vec3), colors: Vec(Color) });

const Container = Union({
  Units: null,
  JustNumber: U32,
  Figures: Vec(Figure)
});

const NType = Newtype(U32);
const NewtypeAlias = Alias(NType);

export const exampleSchema = {
  Message,
  NType,
  Container,
  Color,
  Figure,
  Vec3,
  NewtypeAlias,
  NormalStruct,
  MyEnum,
  MyTuple
};
