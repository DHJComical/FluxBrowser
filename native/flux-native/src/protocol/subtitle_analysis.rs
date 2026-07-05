use super::direction_keywords::DirectionMatch;
use super::subtitle_keywords::{KeywordMatch, KeywordRule};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeSubtitleRequest {
    pub request_id: String,
    pub text: String,
    pub rules: Vec<KeywordRule>,
    pub rules_signature: String,
    pub include_direction_matches: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeSubtitleResponse {
    pub request_id: String,
    pub keyword_matches: Vec<KeywordMatch>,
    pub direction_matches: Vec<DirectionMatch>,
}
