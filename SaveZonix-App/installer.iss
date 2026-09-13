; Inno Setup Script for SaveZonix Windows Installer
#define MyAppName "SaveZonix"
#define MyAppVersion "2.5.0"
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
OutputDir=C:\Users\user\Desktop\All-Pojects\2 DotNET\SaveZonix\SaveZonix-App
OutputBaseFilename=SaveZonix-Setup-v2.5.0
SetupIconFile=C:\Users\user\Desktop\All-Pojects\2 DotNET\SaveZonix\SaveZonix-App\wwwroot\app.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "C:\Users\user\Desktop\All-Pojects\2 DotNET\SaveZonix\SaveZonix-App\bin\Release\net10.0\win-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
