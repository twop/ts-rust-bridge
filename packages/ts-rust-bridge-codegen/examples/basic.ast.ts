import { EntryType, T, Variant as V } from '../src/schema';

const { Alias, Enum, Tuple, Struct, Union, Newtype } = EntryType;

const Aha = Alias('Aha', T.Vec(T.Option(T.Vec(T.Scalar.Str))));
const Aha2 = Alias('Aha2', T.RefTo(Aha));

const MyEnum = Enum('Enum', { variants: ['ONE', 'TWO', 'THREE'] });

const MyTuple = Tuple('Tuple', [T.Option(T.Scalar.Bool), T.Vec(T.Scalar.Str)]);

const NormalStruct = Struct('NormalStruct', {
  a: T.Scalar.U8,
  tuple: T.RefTo(MyTuple)
});

const Message = Union(
  'Message',
  [
    V.Unit('Unit'),
    V.NewType('One', T.Scalar.F32),
    V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.U32]),
    V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
  ],
  { tagAnnotation: false }
);

const Vec3 = Tuple('Vec3', [T.Scalar.F32, T.Scalar.F32, T.Scalar.F32]);
const Color = Tuple('Color', [T.Scalar.U8, T.Scalar.U8, T.Scalar.U8]);
const Figure = Struct('Figure', {
  dots: T.Vec(T.RefTo(Vec3)),
  colors: T.Vec(T.RefTo(Color))
});

const Container = Union(
  'Container',
  [
    V.Unit('Units'),
    V.NewType('JustNumber', T.Scalar.U32),
    V.NewType('Figures', T.Vec(T.RefTo(Figure)))
  ],
  { tagAnnotation: false }
);

const NType = Newtype('NType', T.Scalar.U32);

export const exampleEntries: EntryType[] = [
  Message,
  NType,
  Container,
  Color,
  Figure,
  Vec3,
  // NewtypeAlias,
  NormalStruct,
  MyEnum,
  MyTuple,
  Aha2,
  Aha
];

// // const NewtypeAlias = Alias('NewtypeAlias', T.Option(T.Scalar.Bool));
// const NewtypeAlias = Alias('NewtypeAlias', T.RefTo(NType));
