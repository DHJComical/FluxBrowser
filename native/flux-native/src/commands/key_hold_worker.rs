use crate::io::write_line;
use std::io::{self, BufRead, Write};
use std::thread::sleep;
use std::time::{Duration, Instant};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

struct KeyHoldRequest {
    request_id: String,
    key_codes: Vec<i32>,
    threshold: Duration,
    poll_interval: Duration,
}

pub fn run() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    write_line(&mut stdout, "ready");

    for line_result in stdin.lock().lines() {
        let Ok(line) = line_result else {
            break;
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed.eq_ignore_ascii_case("exit") {
            break;
        }

        let Some(request) = parse_request(trimmed) else {
            continue;
        };

        if request.key_codes.is_empty() {
            emit_status(&mut stdout, &request.request_id, "short");
            continue;
        }

        let start = Instant::now();
        let mut is_short = false;

        while start.elapsed() < request.threshold {
            if !all_keys_down(&request.key_codes) {
                emit_status(&mut stdout, &request.request_id, "short");
                is_short = true;
                break;
            }

            sleep(request.poll_interval);
        }

        if is_short {
            continue;
        }

        emit_status(&mut stdout, &request.request_id, "long");

        while all_keys_down(&request.key_codes) {
            sleep(request.poll_interval);
        }

        emit_status(&mut stdout, &request.request_id, "released");
    }
}

fn parse_request(line: &str) -> Option<KeyHoldRequest> {
    let mut parts = line.split('|');
    let request_id = parts.next()?.trim().to_owned();
    let key_codes_part = parts.next()?.trim();
    let threshold_ms = parts.next()?.trim().parse::<u64>().ok()?;
    let poll_ms = parts.next()?.trim().parse::<u64>().ok()?;

    let key_codes = key_codes_part
        .split(',')
        .filter_map(|part| part.trim().parse::<i32>().ok())
        .collect::<Vec<_>>();

    Some(KeyHoldRequest {
        request_id,
        key_codes,
        threshold: Duration::from_millis(threshold_ms),
        poll_interval: Duration::from_millis(poll_ms.max(1)),
    })
}

fn all_keys_down(key_codes: &[i32]) -> bool {
    key_codes
        .iter()
        .all(|key_code| unsafe { (GetAsyncKeyState(*key_code) as u16 & 0x8000) != 0 })
}

fn emit_status(stdout: &mut impl Write, request_id: &str, status: &str) {
    let line = format!("{request_id}|{status}");
    write_line(stdout, &line);
}
