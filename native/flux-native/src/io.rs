use serde::Serialize;
use std::io::Write;

pub fn write_line(stdout: &mut impl Write, line: &str) {
    let _ = writeln!(stdout, "{line}");
    let _ = stdout.flush();
}

pub fn write_json_line<T>(stdout: &mut impl Write, value: &T)
where
    T: Serialize,
{
    if let Ok(serialized) = serde_json::to_string(value) {
        write_line(stdout, &serialized);
    }
}
