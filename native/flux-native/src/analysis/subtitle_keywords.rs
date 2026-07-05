use crate::protocol::subtitle_keywords::{KeywordMatch, KeywordRule};
use regex::{Regex, RegexBuilder};

#[derive(Clone)]
pub struct CompiledRule {
    pub id: String,
    pub pattern: String,
    pub regex: Regex,
}

pub fn compile_rules(rules: &[KeywordRule]) -> Vec<CompiledRule> {
    rules.iter().filter_map(compile_rule).collect::<Vec<_>>()
}

pub fn analyze_keywords(text: &str, compiled_rules: &[CompiledRule]) -> Vec<KeywordMatch> {
    compiled_rules
        .iter()
        .filter_map(|rule| {
            rule.regex.find(text).map(|matched| KeywordMatch {
                rule_id: rule.id.clone(),
                pattern: rule.pattern.clone(),
                matched_text: matched.as_str().to_owned(),
            })
        })
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
