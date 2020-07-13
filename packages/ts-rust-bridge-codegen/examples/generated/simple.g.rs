
use serde::Deserialize;


#[derive(Deserialize, Serialize)]
pub enum Message {
    Unit,
    One(f32),
    Two(Option<bool>, u32),
    VStruct { id: String, data: String },
}


#[derive(Deserialize, Serialize)]
pub struct NType(pub u32);


#[derive(Deserialize, Serialize)]
pub enum Container {
    Units,
    JustNumber(u32),
    Figures(Vec<Figure>),
}


#[derive(Deserialize, Serialize)]
pub struct Color(pub u8, pub u8, pub u8);


#[derive(Deserialize, Serialize)]
pub struct Figure {
    pub dots: Vec<Vec3>,
    pub colors: Vec<Color>,
}


#[derive(Deserialize, Serialize)]
pub struct Vec3(pub f32, pub f32, pub f32);


pub type NewtypeAlias = NType;


#[derive(Deserialize, Serialize)]
pub struct NormalStruct {
    pub a: u8,
    pub tuple: MyTuple,
}


#[derive(Deserialize, Serialize, Clone, Copy)]
pub enum MyEnum {
    ONE,
    TWO,
    THREE,
}


#[derive(Deserialize, Serialize)]
pub struct MyTuple(pub Option<bool>, pub Vec<String>);

