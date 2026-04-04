@echo off
setlocal

call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1

cd /d "%~dp0..\src-tauri"
cargo clippy --all-targets --all-features -- -D warnings -D clippy::all && cargo fmt --all
