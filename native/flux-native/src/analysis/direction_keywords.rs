use crate::protocol::direction_keywords::DirectionMatch;
use regex::Regex;
use std::sync::OnceLock;

struct CompiledDirectionDefinition {
    key: &'static str,
    patterns: Vec<Regex>,
}

static COMPILED_DIRECTION_DEFINITIONS: OnceLock<Vec<CompiledDirectionDefinition>> = OnceLock::new();

pub fn analyze_direction_keywords(text: &str) -> Vec<DirectionMatch> {
    let mut working_text = text.trim().to_owned();
    if working_text.is_empty() {
        return Vec::new();
    }

    let mut matches = Vec::new();
    for definition in compiled_direction_definitions() {
        let Some(matched_text) = find_first_match(&working_text, &definition.patterns) else {
            continue;
        };

        matches.push(DirectionMatch {
            direction: definition.key.to_owned(),
            matched_text: matched_text.to_owned(),
        });
        working_text = working_text.replacen(matched_text, " ", 1);
    }

    matches
}

fn compiled_direction_definitions() -> &'static [CompiledDirectionDefinition] {
    COMPILED_DIRECTION_DEFINITIONS
        .get_or_init(build_direction_definitions)
        .as_slice()
}

fn build_direction_definitions() -> Vec<CompiledDirectionDefinition> {
    vec![
        compile_definition(
            "northeast",
            &[
                r"\x{4e1c}\x{5317}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{89d2})?",
                r"\x{5317}\x{504f}\x{4e1c}",
                r"\x{4e1c}\x{504f}\x{5317}",
                r"(?i)\bnorth[\s-]?east\b",
                r"(?i)\bnortheast\b",
            ],
        ),
        compile_definition(
            "southeast",
            &[
                r"\x{4e1c}\x{5357}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{89d2})?",
                r"\x{5357}\x{504f}\x{4e1c}",
                r"\x{4e1c}\x{504f}\x{5357}",
                r"(?i)\bsouth[\s-]?east\b",
                r"(?i)\bsoutheast\b",
            ],
        ),
        compile_definition(
            "southwest",
            &[
                r"\x{897f}\x{5357}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{89d2})?",
                r"\x{5357}\x{504f}\x{897f}",
                r"\x{897f}\x{504f}\x{5357}",
                r"(?i)\bsouth[\s-]?west\b",
                r"(?i)\bsouthwest\b",
            ],
        ),
        compile_definition(
            "northwest",
            &[
                r"\x{897f}\x{5317}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{89d2})?",
                r"\x{5317}\x{504f}\x{897f}",
                r"\x{897f}\x{504f}\x{5317}",
                r"(?i)\bnorth[\s-]?west\b",
                r"(?i)\bnorthwest\b",
            ],
        ),
        compile_definition(
            "north",
            &[
                r"(?:\x{6b63})?\x{5317}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{7aef}|\x{5934})?",
                r"(?i)\bnorth\b",
            ],
        ),
        compile_definition(
            "east",
            &[
                r"(?:\x{6b63})?\x{4e1c}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{7aef}|\x{5934})?",
                r"(?i)\beast\b",
            ],
        ),
        compile_definition(
            "south",
            &[
                r"(?:\x{6b63})?\x{5357}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{7aef}|\x{5934})?",
                r"(?i)\bsouth\b",
            ],
        ),
        compile_definition(
            "west",
            &[
                r"(?:\x{6b63})?\x{897f}(?:\x{65b9}|\x{8fb9}|\x{4fa7}|\x{9762}|\x{5411}|\x{90e8}|\x{7aef}|\x{5934})?",
                r"(?i)\bwest\b",
            ],
        ),
    ]
}

fn compile_definition(key: &'static str, patterns: &[&str]) -> CompiledDirectionDefinition {
    CompiledDirectionDefinition {
        key,
        patterns: patterns
            .iter()
            .map(|pattern| Regex::new(pattern).expect("direction keyword regex must be valid"))
            .collect(),
    }
}

fn find_first_match<'a>(text: &'a str, patterns: &[Regex]) -> Option<&'a str> {
    patterns
        .iter()
        .find_map(|pattern| pattern.find(text).map(|matched| matched.as_str()))
}
