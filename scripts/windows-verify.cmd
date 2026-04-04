@echo off
setlocal

call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1

cd /d "%~dp0.."
pnpm format && pnpm lint && pnpm test
