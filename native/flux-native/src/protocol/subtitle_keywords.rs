use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeKeywordsRequest {
    pub request_id: String,
    pub text: String,
    pub rules: Vec<KeywordRule>,
    pub rules_signature: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeywordRule {
    pub id: String,
    pub pattern: String,
    pub match_case: bool,
    pub whole_word: bool,
    pub is_regex: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeKeywordsResponse {
    pub request_id: String,
    pub matches: Vec<KeywordMatch>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeywordMatch {
    pub rule_id: String,
    pub pattern: String,
    pub matched_text: String,
}
