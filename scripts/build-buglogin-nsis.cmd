@echo off
setlocal

call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1

for /f "delims=" %%I in ('where link') do set "BUGLOGIN_LINKER=%%I"
if not defined BUGLOGIN_LINKER exit /b 1

set "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=%BUGLOGIN_LINKER%"

cargo -V
where link
echo Using linker: %CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER%
pnpm tauri build --bundles nsis
