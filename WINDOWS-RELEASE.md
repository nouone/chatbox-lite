# Windows installer releases

Users download an EXE from your fork's Releases page; they do not build source. Windows x64 installers include verified Whisper CPU runtime, DLLs, the English base model and both licenses. Kokoro and embeddings remain optional separate services. The installer is unsigned unless you add signing later. Vendor auto-updates remain removed.

## First test build on GitHub

1. Push this source, including `.github/workflows/windows-lite.yml`, to your own repository. Put the workflow on its default branch so GitHub shows Run workflow.
2. Open **Actions → Windows Lite installer → Run workflow**. Enter an unused semantic version, such as `1.24.1`, and run it on the branch you want to test.
3. After it succeeds, download the **Chatbox-Lite-Windows-x64** artifact from that run and extract it. It contains the Setup EXE and SHA256SUMS.txt. Manual runs do not publish a release.
4. Verify the file with `Get-FileHash .\Chatbox-Lite-1.24.1-x64-Setup.exe -Algorithm SHA256` and compare the checksum. Test installation, launch, custom-provider replies, microphone transcription, Help, phone pairing and chat persistence. Back up important chats first.

The workflow installs Node 22.21.1 and pnpm 10.33.0, checks types, runs the selected Lite regression suites, prepares speech resources, builds the app, packages NSIS x64 and verifies the packaged speech files match the inputs. It uses GitHub's normal workflow token; no personal token or vendor publishing credentials are needed.

## Prepare a public release

After committing the tested source to your fork, create and push a version tag from that commit:

```powershell
git tag lite-v1.24.1
git push origin lite-v1.24.1
```

Choose a new version for every release. Tags must contain a semantic version after `lite-v`, for example `lite-v1.24.2` or `lite-v1.24.2-beta.1`. The workflow applies that version to the app package and lock metadata before building, so the installed version and EXE name agree.

A successful tagged build attaches the EXE and checksum file to a **draft** Release. Open Releases, inspect the draft, mark preview versions as prereleases, and publish when your installation checks pass. Draft creation is intentional: a successful compile does not verify microphone hardware or your live providers. Users can then download the installer without a GitHub Actions artifact login. No upstream Chatbox release is changed.

## Local build

In the source folder with Node 22 active:

```powershell
pnpm install --frozen-lockfile
.\scripts\Set-LiteReleaseVersion.ps1 -Version 1.24.1
# Install the download tool only on the build machine if it is missing:
python -m pip install 'huggingface_hub>=1,<2'
.\scripts\setup-local-speech.ps1
pnpm run check
pnpm run build
.\scripts\Build-LiteInstaller.ps1
```

Output: `release/build/Chatbox-Lite-1.24.1-x64-Setup.exe` and `SHA256SUMS.txt`. Version preparation changes build metadata in your working tree; commit those changes when preparing a release locally. Dictation setup downloads are build-time only. End users do not need the CLI or a model download.

The workflow is ready to run after it is pushed to your repository; it has not run on GitHub merely because these files exist locally. If a run fails, inspect its first failing step before publishing anything.
