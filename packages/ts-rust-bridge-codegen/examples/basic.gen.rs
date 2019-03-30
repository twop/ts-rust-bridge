
use bincode;
use serde::Deserialize;


#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "tag", content = "value")]
pub enum Message {
    Unit,
    One(f32),
    Two(Option<bool>, f32),
    VStruct { id: String, data: String },
}


#[derive(Deserialize, Debug, Clone)]
pub struct NormalStruct {
    pub a: f32,
    pub tuple: Tuple,
}


#[derive(Deserialize, Debug, Clone)]
pub enum Enum {
    ONE,
    TWO,
    THREE,
}


#[derive(Deserialize, Debug, Clone)]
pub struct Tuple(pub Option<bool>, pub Vec<String>);


pub type Aha = Vec<Option<Vec<String>>>;

