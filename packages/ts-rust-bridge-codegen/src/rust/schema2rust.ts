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

export type RustTypeOptions = {
  derive: [string, ...string[]];
};

const mapValues = <A, B>(
  obj: { [name: string]: A },
  f: (a: A) => B
): { [name: string]: B } =>
  Object.fromEntries(
    Object.entries(obj).map(([key, val]): [string, B] => [key, f(val)])
  );

export type ElementWithRustSettings = [SchemaElement, RustTypeOptions];

const hasOptions = (
  elem: SchemaElement | ElementWithRustSettings
): elem is ElementWithRustSettings => Array.isArray(elem);

export const schema2rust = (entries: {
  [name: string]: SchemaElement | ElementWithRustSettings;
}): FileBlock[] => {
  const lookup = createLookupName(
    mapValues(entries, el => (hasOptions(el) ? el[0] : el))
  );

  return Object.entries(entries).map(([name, entry]) => {
    const [el, opt] = hasOptions(entry) ? entry : [entry, undefined];

    return matchSchemaElement(el, {
      Alias: t => aliasToAlias(name, t, lookup),
      Enum: variants => enumToEnum(name, variants, opt),
      Newtype: t => newtypeToStruct(name, t, lookup, opt),
      Tuple: fields => tupleToStruct(name, fields, lookup, opt),
      Struct: members => structToStruct(name, members, lookup, opt),
      Union: (variants, options) =>
        unionToEnum(name, variants, options, lookup, opt)
    });
  });
};

const deriveBlock = (opt: RustTypeOptions | undefined): string =>
  opt
    ? `#[derive(Deserialize, Serialize, ${opt.derive.join(', ')})]`
    : `#[derive(Deserialize, Serialize)]`;

const aliasToAlias = (name: string, type: Type, lookup: LookupName) => `
pub type ${name} = ${typeToString(type, lookup)};
`;

const enumToEnum = (
  name: string,
  { variants }: EnumVariants,
  opt: RustTypeOptions | undefined
): string => `
${deriveBlock(opt)}
pub enum ${name} {
${variants.map(v => `    ${v},`).join('\n')}
}
`;

const newtypeToStruct = (
  name: string,
  type: Type,
  lookup: LookupName,
  opt: RustTypeOptions | undefined
): string => `
${deriveBlock(opt)}
pub struct ${name}(pub ${typeToString(type, lookup)});
`;

const tupleToStruct = (
  name: string,
  fields: Type[],
  lookup: LookupName,
  opt: RustTypeOptions | undefined
): string => `
${deriveBlock(opt)}
pub struct ${name}(${fields
  .map(t => `pub ${typeToString(t, lookup)}`)
  .join(', ')});
`;
const structToStruct = (
  name: string,
  members: StructMembers,
  lookup: LookupName,
  opt: RustTypeOptions | undefined
): string => `
${deriveBlock(opt)}
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
  lookup: LookupName,
  opt: RustTypeOptions | undefined
): string => `
${deriveBlock(opt)}${
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
