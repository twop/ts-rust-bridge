
#[derive(Deserialize, Serialize)]
pub struct Shirt {
    pub size: Size,
    pub color: String,
    pub price: f32,
}


#[derive(Deserialize, Serialize)]
pub enum Size {
    S,
    M,
    L,
}
