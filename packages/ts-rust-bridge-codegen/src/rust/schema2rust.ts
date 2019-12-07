import {
  EnumVariants,
  StructMembers,
  Scalar,
  Type,
  SchemaElement,
  TypeTag,
  Variant,
  FileBlock,
  UnionOptions,
  LookupName,
  createLookupName,
  matchSchemaElement
} from '../schema';

export const schema2rust = (entries: {
  [name: string]: SchemaElement;
}): FileBlock[] => {
  const lookup = createLookupName(entries);
  return Object.entries(entries).map(([name, entry]) =>
    matchSchemaElement(entry, {
      Alias: t => aliasToAlias(name, t, lookup),
      Enum: variants => enumToEnum(name, variants),
      Newtype: t => newtypeToStruct(name, t, lookup),
      Tuple: fields => tupleToStruct(name, fields, lookup),
      Struct: members => structToStruct(name, members, lookup),
      Union: (variants, options) => unionToEnum(name, variants, options, lookup)
    })
  );
};

const aliasToAlias = (name: string, type: Type, lookup: LookupName) => `
pub type ${name} = ${typeToString(type, lookup)};
`;

const enumToEnum = (name: string, { variants }: EnumVariants): string => `
#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum ${name} {
${variants.map(v => `    ${v},`).join('\n')}
}
`;

const newtypeToStruct = (
  name: string,
  type: Type,
  lookup: LookupName
): string => `
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ${name}(pub ${typeToString(type, lookup)});
`;

const tupleToStruct = (
  name: string,
  fields: Type[],
  lookup: LookupName
): string => `
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ${name}(${fields
  .map(t => `pub ${typeToString(t, lookup)}`)
  .join(', ')});
`;
const structToStruct = (
  name: string,
  members: StructMembers,
  lookup: LookupName
): string => `
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ${name} {
${Object.keys(members)
  .map(n => {
    const snakeName = camelToSnakeCase(n);
    const field = `pub ${snakeName}: ${typeToString(members[n], lookup)}`;
    return snakeName === n
      ? `    ${field},`
      : `    #[serde(rename = "${n}")]\n    ${field},\n`;
  })
  .join('\n')}
}
`;

const unionToEnum = (
  name: string,
  variants: Variant[],
  { tagAnnotation }: UnionOptions,
  lookup: LookupName
): string => `
#[derive(Deserialize, Serialize, Debug, Clone)]${
  tagAnnotation ? '\n#[serde(tag = "tag", content = "value")]' : ''
}
pub enum ${name} {
${variants.map(v => `    ${variantStr(v, lookup)},`).join('\n')}
}
`;

const variantStr = (v: Variant, lookup: LookupName) =>
  Variant.match(v, {
    Unit: name => name,
    NewType: (name, type) => `${name}(${typeToString(type, lookup)})`,
    Tuple: (name, fields) =>
      `${name}(${fields.map(f => typeToString(f, lookup)).join(', ')})`,
    Struct: (name, members) =>
      `${name} { ${Object.keys(members)
        .map(n => {
          const snakeName = camelToSnakeCase(n);

          return `${
            snakeName === n ? '' : `#[serde(rename = "${n}")] `
          }${camelToSnakeCase(n)}: ${typeToString(members[n], lookup)}`;
        })
        .join(', ')} }`
  });

const scalarToString = (scalar: Scalar): string => {
  switch (scalar) {
    case Scalar.Bool:
      return 'bool';
    case Scalar.F32:
      return 'f32';
    case Scalar.F64:
      return 'f64';
    case Scalar.U8:
      return 'u8';
    case Scalar.U16:
      return 'u16';
    case Scalar.U32:
      return 'u32';
    case Scalar.USIZE:
      return 'usize';
    case Scalar.I32:
      return 'i32';
    case Scalar.Str:
      return 'String';
  }
};

const typeToString = (type: Type, lookup: LookupName): string => {
  switch (type.tag) {
    case TypeTag.Option:
      return `Option<${typeToString(type.value, lookup)}>`;
    case TypeTag.Scalar:
      return scalarToString(type.value);
    case TypeTag.Vec:
      return `Vec<${typeToString(type.value, lookup)}>`;
  }

  return lookup(type);
};

const camelToSnakeCase = (str: string) =>
  str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
