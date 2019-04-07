
use bincode;
use serde::Deserialize;


#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "tag", content = "value")]
pub enum Message {
    Unit,
    AnotherUnit,
    One(f32),
    Two(Option<bool>, u32),
    VStruct { id: String, data: String },
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct NType(pub u32);


#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(tag = "tag", content = "value")]
pub enum Container {
    Units,
    JustNumber(u32),
    Figures(Vec<Figure>),
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Color(pub u8, pub u8, pub u8);


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Figure {
    pub dots: Vec<Vec3>,
    pub colors: Vec<Color>,
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Vec3(pub f32, pub f32, pub f32);


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct NormalStruct {
    pub a: u8,
    pub tuple: Tuple,
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum Enum {
    ONE,
    TWO,
    THREE,
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Tuple(pub Option<bool>, pub Vec<String>);


pub type Aha = Vec<Option<Vec<String>>>;

