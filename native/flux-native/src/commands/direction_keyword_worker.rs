use crate::analysis::direction_keywords::analyze_direction_keywords;
use crate::io::write_json_line;
use crate::protocol::direction_keywords::{
    AnalyzeDirectionKeywordsRequest, AnalyzeDirectionKeywordsResponse,
};
use std::io::{self, BufRead};

pub fn run() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line_result in stdin.lock().lines() {
        let Ok(line) = line_result else {
            break;
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(request) = serde_json::from_str::<AnalyzeDirectionKeywordsRequest>(trimmed) else {
            continue;
        };

        let response = AnalyzeDirectionKeywordsResponse {
            request_id: request.request_id,
            matches: analyze_direction_keywords(&request.text),
        };

        write_json_line(&mut stdout, &response);
    }
}
