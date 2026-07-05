pub const USAGE: &str = "Usage: flux-native <key-hold-worker|focus-borderless-maximized|subtitle-keyword-worker|direction-keyword-worker>";

pub enum CliCommand {
    KeyHoldWorker,
    FocusBorderlessMaximized { flux_process_id: u32 },
    SubtitleKeywordWorker,
    DirectionKeywordWorker,
}

impl CliCommand {
    pub fn parse<I>(args: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = String>,
    {
        let mut args = args.into_iter();
        let command = args.next().unwrap_or_default();

        match command.as_str() {
            "key-hold-worker" => Ok(Self::KeyHoldWorker),
            "focus-borderless-maximized" => {
                let Some(flux_process_id) = args.next() else {
                    return Err(
                        "Usage: flux-native focus-borderless-maximized <flux-pid>".to_owned()
                    );
                };

                let flux_process_id = flux_process_id
                    .parse::<u32>()
                    .map_err(|_| format!("Invalid Flux process id: {flux_process_id}"))?;

                Ok(Self::FocusBorderlessMaximized { flux_process_id })
            }
            "subtitle-keyword-worker" => Ok(Self::SubtitleKeywordWorker),
            "direction-keyword-worker" => Ok(Self::DirectionKeywordWorker),
            _ => Err(USAGE.to_owned()),
        }
    }
}
