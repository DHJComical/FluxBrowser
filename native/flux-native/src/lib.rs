pub mod analysis;
pub mod cli;
pub mod io;
pub mod protocol;

#[cfg(target_os = "windows")]
pub mod commands;

pub fn run_cli<I>(args: I) -> i32
where
    I: IntoIterator<Item = String>,
{
    #[cfg(not(target_os = "windows"))]
    {
        let _ = args;
        eprintln!("flux-native currently supports Windows only.");
        1
    }

    #[cfg(target_os = "windows")]
    {
        match cli::CliCommand::parse(args) {
            Ok(cli::CliCommand::KeyHoldWorker) => {
                commands::key_hold_worker::run();
                0
            }
            Ok(cli::CliCommand::FocusBorderlessMaximized { flux_process_id }) => {
                commands::focus_borderless_maximized::run(flux_process_id);
                0
            }
            Ok(cli::CliCommand::SubtitleKeywordWorker) => {
                commands::subtitle_keyword_worker::run();
                0
            }
            Ok(cli::CliCommand::DirectionKeywordWorker) => {
                commands::direction_keyword_worker::run();
                0
            }
            Ok(cli::CliCommand::SubtitleAnalysisWorker) => {
                commands::subtitle_analysis_worker::run();
                0
            }
            Err(message) => {
                eprintln!("{message}");
                1
            }
        }
    }
}
