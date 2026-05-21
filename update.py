"""DevCraft updater — tries git pull first, falls back to ZIP download."""
import os, sys, subprocess, urllib.request, zipfile, shutil, tempfile, pathlib

REPO_ZIP = "https://github.com/daptime/minecraft/archive/refs/heads/claude/minecraft-replica-build-B4hVM.zip"
ZIP_ROOT  = "minecraft-claude-minecraft-replica-build-B4hVM"  # folder inside zip

HERE = pathlib.Path(__file__).parent.resolve()

SEP = "=" * 46

def banner(msg):
    print(SEP)
    print(" ", msg)
    print(SEP)

def try_git_pull():
    git = shutil.which("git")
    if not git:
        return False, "git not found"
    if not (HERE / ".git").exists():
        return False, "not a git repository"
    try:
        r = subprocess.run([git, "pull"], cwd=str(HERE), capture_output=True, text=True)
        if r.returncode == 0:
            print(r.stdout.strip())
            return True, None
        return False, r.stderr.strip() or r.stdout.strip()
    except Exception as e:
        return False, str(e)

def zip_update():
    print("Downloading latest version from GitHub...")
    try:
        tmp = tempfile.mkdtemp()
        zip_path = os.path.join(tmp, "devcraft.zip")

        def _progress(count, block, total):
            if total > 0:
                pct = min(100, count * block * 100 // total)
                print(f"\r  {pct}% ", end="", flush=True)

        urllib.request.urlretrieve(REPO_ZIP, zip_path, _progress)
        print("\r  100%")
        print("Extracting...")

        with zipfile.ZipFile(zip_path, "r") as zf:
            members = zf.namelist()
            for member in members:
                # Strip the top-level folder from the path
                rel = member[len(ZIP_ROOT):].lstrip("/")
                if not rel:
                    continue
                dest = HERE / rel
                if member.endswith("/"):
                    dest.mkdir(parents=True, exist_ok=True)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(member) as src, open(dest, "wb") as dst:
                        shutil.copyfileobj(src, dst)
        shutil.rmtree(tmp, ignore_errors=True)
        return True, None
    except Exception as e:
        return False, str(e)

def main():
    print()
    banner("DevCraft — update to the latest version")
    print()

    ok, err = try_git_pull()
    if ok:
        print()
        banner("Update complete via git pull.")
        print("  Restart DevCraft to play the new version.")
    else:
        if err:
            print(f"  git pull skipped: {err}")
        print("  Falling back to direct download...")
        print()
        ok, err = zip_update()
        if ok:
            print()
            banner("Update complete!")
            print("  Restart DevCraft to play the new version.")
        else:
            print()
            banner("Update FAILED")
            print(f"  {err}")
            print("  Check your internet connection and try again.")
            sys.exit(1)

    print()

if __name__ == "__main__":
    main()
    input("Press Enter to close...")
