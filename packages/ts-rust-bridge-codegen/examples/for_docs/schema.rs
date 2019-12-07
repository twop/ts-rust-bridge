
use serde::{Deserialize, Serialize};


#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum Size {
    S,
    M,
    L,
}


#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Shirt {
    pub size: Size,
    pub color: String,
    pub price: f32,
}

