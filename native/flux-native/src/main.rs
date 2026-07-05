fn main() {
    std::process::exit(flux_native::run_cli(std::env::args().skip(1)));
}
