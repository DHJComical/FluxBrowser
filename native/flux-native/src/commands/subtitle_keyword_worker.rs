use crate::io::write_json_line;
use crate::protocol::subtitle_keywords::{
    AnalyzeKeywordsRequest, AnalyzeKeywordsResponse, KeywordMatch, KeywordRule,
};
use regex::{Regex, RegexBuilder};
use std::collections::HashMap;
use std::io::{self, BufRead};

#[derive(Clone)]
struct CompiledRule {
    id: String,
    pattern: String,
    regex: Regex,
}

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

        let Ok(request) = serde_json::from_str::<AnalyzeKeywordsRequest>(trimmed) else {
            continue;
        };

        let compiled_rules = cache
            .entry(request.rules_signature.clone())
            .or_insert_with(|| compile_rules(&request.rules))
            .clone();

        let matches = compiled_rules
            .iter()
            .filter_map(|rule| {
                rule.regex.find(&request.text).map(|matched| KeywordMatch {
                    rule_id: rule.id.clone(),
                    pattern: rule.pattern.clone(),
                    matched_text: matched.as_str().to_owned(),
                })
            })
            .collect::<Vec<_>>();

        let response = AnalyzeKeywordsResponse {
            request_id: request.request_id,
            matches,
        };

        write_json_line(&mut stdout, &response);
    }
}

fn compile_rules(rules: &[KeywordRule]) -> Vec<CompiledRule> {
    rules
        .iter()
        .filter_map(|rule| compile_rule(rule))
        .collect::<Vec<_>>()
}

fn compile_rule(rule: &KeywordRule) -> Option<CompiledRule> {
    if rule.pattern.trim().is_empty() {
        return None;
    }

    let pattern = if rule.is_regex {
        rule.pattern.clone()
    } else if rule.whole_word {
        format!(r"\b{}\b", regex::escape(&rule.pattern))
    } else {
        regex::escape(&rule.pattern)
    };

    let mut builder = RegexBuilder::new(&pattern);
    builder.case_insensitive(!rule.match_case);
    let Ok(regex) = builder.build() else {
        return None;
    };

    Some(CompiledRule {
        id: rule.id.clone(),
        pattern: rule.pattern.clone(),
        regex,
    })
}
