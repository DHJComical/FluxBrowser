use crate::analysis::direction_keywords::analyze_direction_keywords;
use crate::analysis::subtitle_keywords::{CompiledRule, analyze_keywords, compile_rules};
use crate::io::write_json_line;
use crate::protocol::subtitle_analysis::{AnalyzeSubtitleRequest, AnalyzeSubtitleResponse};
use std::collections::HashMap;
use std::io::{self, BufRead};

pub fn run() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut cache: HashMap<String, Vec<CompiledRule>> = HashMap::new();

    for line_result in stdin.lock().lines() {
        let Ok(line) = line_result else {
            break;
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(request) = serde_json::from_str::<AnalyzeSubtitleRequest>(trimmed) else {
            continue;
        };

        let compiled_rules = cache
            .entry(request.rules_signature.clone())
            .or_insert_with(|| compile_rules(&request.rules))
            .clone();

        let response = AnalyzeSubtitleResponse {
            request_id: request.request_id,
            keyword_matches: analyze_keywords(&request.text, &compiled_rules),
            direction_matches: if request.include_direction_matches {
                analyze_direction_keywords(&request.text)
            } else {
                Vec::new()
            },
        };

        write_json_line(&mut stdout, &response);
    }
}
