@echo off

rem Exit with code 0 only if there is exactly one argument
echo %1

set argCount=0
for %%x in (%*) do set /a argCount+=1
if %argCount%==1 exit /b 0
exit /b 1
