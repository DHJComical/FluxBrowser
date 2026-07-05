use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeDirectionKeywordsRequest {
    pub request_id: String,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeDirectionKeywordsResponse {
    pub request_id: String,
    pub matches: Vec<DirectionMatch>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectionMatch {
    pub direction: String,
    pub matched_text: String,
}
