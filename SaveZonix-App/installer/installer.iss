; Inno Setup Script for SaveZonix Windows Installer
#define MyAppName "SaveZonix"
#define MyAppVersion "2.5.2"
#define MyAppPublisher "SaveZonix Inc."
#define MyAppURL "https://save-zonix.vercel.app"
#define MyAppExeName "Zonix.exe"

[Setup]
AppId={{D8C9A3F1-5271-4A82-824E-669DF47D5B67}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=
OutputDir=..\installer
OutputBaseFilename=SaveZonix-Setup-v2.5.2
SetupIconFile=..\wwwroot\app.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/fast
SolidCompression=yes
LZMANumBlockThreads=8
LZMAUseSeparateProcess=yes
WizardStyle=modern
DisableReadyPage=yes
PrivilegesRequired=lowest
CloseApplications=yes
CloseApplicationsFilter=Zonix.exe
RestartApplications=no

[InstallDelete]
Type: files; Name: "{app}\Zonix.exe"
Type: files; Name: "{app}\wwwroot\favicon.ico.gz"
Type: files; Name: "{app}\wwwroot\favicon.ico.br"
Type: files; Name: "{app}\wwwroot\app.ico.gz"
Type: files; Name: "{app}\wwwroot\app.ico.br"

[Code]
const
  DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

function DwmSetWindowAttribute(hwnd: HWND; dwAttribute: DWORD; var pvAttribute: Integer; cbAttribute: DWORD): Integer;
external 'DwmSetWindowAttribute@dwmapi.dll stdcall';

procedure InitializeWizard();
var
  DarkMode: Integer;
begin
  DarkMode := 1;
  try
    DwmSetWindowAttribute(WizardForm.Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, DarkMode, 4);
  except
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  // Cleanly kill any running Zonix processes without user prompts
  Exec('taskkill.exe', '/F /IM Zonix.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;

// Automatically launch live Vercel feedback page upon uninstallation completion
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ErrorCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    ShellExec('open', 'https://save-zonix.vercel.app/feedback?source=desktop', '', '', SW_SHOW, ewNoWait, ErrorCode);
  end;
end;

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\bin\Release\net10.0\win-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.pdb"
Source: "..\Extension\*"; DestDir: "{app}\Extension"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\wwwroot\app.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\wwwroot\app.ico"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
