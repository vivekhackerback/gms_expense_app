
#!/usr/bin/env python3

import os
import sys
import getpass
import shutil
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen

# ==================================================
# CONFIGURATION
# ==================================================

PROJECT = Path("/home/officialtplpro/gms_expense_app")

REPOSITORY = "https://github.com/vivekhackerback/gms_expense_app.git"
BRANCH = "main"

KEYSTORE = PROJECT / "key/my-upload-key.keystore"

AAB_SOURCE = (
    PROJECT /
    "android/app/build/outputs/bundle/release/app-release.aab"
)

NGINX_DIR = Path("/var/www/gms_expense_apk")
AAB_DEST = NGINX_DIR / "app-release.aab"

SERVER_IP = "34.47.166.2"
DOWNLOAD_URL = f"http://{SERVER_IP}/app-release.aab"

BACKUP_DIR = Path.home() / "expense_app_backup"

# ==================================================
# COMMAND EXECUTOR
# ==================================================

def run(command, cwd=None, env=None):

    print("\n$", " ".join(map(str, command)), flush=True)

    subprocess.run(
        command,
        cwd=cwd,
        env=env,
        check=True
    )


# ==================================================
# SIGNING CREDENTIALS
# ==================================================

def get_signing_credentials():

    print("\n[1/10] Checking signing credentials")

    if not KEYSTORE.exists():
        raise FileNotFoundError(
            f"Keystore not found: {KEYSTORE}"
        )

    env = os.environ.copy()

    env["KEYSTORE_PASSWORD"] = (
        os.getenv("KEYSTORE_PASSWORD")
        or getpass.getpass("Keystore password: ")
    )

    env["KEY_ALIAS"] = (
        os.getenv("KEY_ALIAS")
        or input("Key alias: ").strip()
    )

    env["KEY_PASSWORD"] = (
        os.getenv("KEY_PASSWORD")
        or getpass.getpass("Key password: ")
    )

    for key in [
        "KEYSTORE_PASSWORD",
        "KEY_ALIAS",
        "KEY_PASSWORD"
    ]:
        if not env[key]:
            raise ValueError(f"{key} is missing")

    return env


# ==================================================
# BACKUP LOCAL GIT CHANGES
# ==================================================

def backup_local_changes():

    print("\n[2/10] Checking local Git changes")

    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=PROJECT,
        capture_output=True,
        text=True,
        check=True
    )

    if not result.stdout.strip():
        print("No local changes found.")
        return

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Preserve important local configuration files
    for filename in [
        "app.json",
        "package.json",
        "package-lock.json"
    ]:

        source = PROJECT / filename

        if source.exists():

            destination = BACKUP_DIR / filename

            shutil.copy2(source, destination)

            print(f"Backup created: {destination}")

    # Stash all tracked and untracked changes
    run([
        "git", "stash", "push", "-u",
        "-m", "Automatic backup before Android deployment"
    ], cwd=PROJECT)

    print("Local changes safely stashed.")


# ==================================================
# UPDATE GITHUB REPOSITORY
# ==================================================

def update_repository():

    print("\n[3/10] Fetching latest GitHub code")

    run(
        ["git", "fetch", "origin"],
        cwd=PROJECT
    )

    run(
        ["git", "pull", "--ff-only", "origin", BRANCH],
        cwd=PROJECT
    )

    run(
        ["git", "log", "-1", "--oneline"],
        cwd=PROJECT
    )


# ==================================================
# INSTALL DEPENDENCIES
# ==================================================

def install_dependencies():

    print("\n[4/10] Installing Node dependencies")

    run(
        ["npm", "ci"],
        cwd=PROJECT
    )


# ==================================================
# VERIFY KEYSTORE
# ==================================================

def verify_keystore(env):

    print("\n[5/10] Verifying existing release keystore")

    run([
        "keytool",
        "-list",
        "-keystore", str(KEYSTORE),
        "-alias", env["KEY_ALIAS"]
    ], cwd=PROJECT, env=env)


# ==================================================
# REMOVE OLD GRADLE BUILD FILES
# ==================================================

def clean_gradle():

    print("\n[6/10] Removing old Gradle build files")

    android = PROJECT / "android"

    folders = [
        android / ".gradle",
        android / "build",
        android / "app" / "build"
    ]

    for folder in folders:

        if folder.exists():

            print(f"Removing: {folder}")

            shutil.rmtree(folder)

        else:

            print(f"Already clean: {folder}")

    print("Gradle cleanup completed.")


# ==================================================
# BUILD SIGNED ANDROID AAB
# ==================================================

def build_aab(env):

    print("\n[7/10] Building fresh signed Android AAB")

    android = PROJECT / "android"

    run([
        "./gradlew",
        "bundleRelease",
        "--no-daemon",
        "--no-build-cache"
    ], cwd=android, env=env)

    if not AAB_SOURCE.exists():
        raise FileNotFoundError(
            "Android AAB was not generated."
        )

    print(
        f"AAB generated: {AAB_SOURCE}"
    )

    print(
        f"Size: {AAB_SOURCE.stat().st_size / (1024 * 1024):.2f} MB"
    )


# ==================================================
# VERIFY AAB SIGNATURE
# ==================================================

def verify_signature():

    print("\n[8/10] Verifying AAB signature")

    run([
        "jarsigner",
        "-verify",
        "-certs",
        str(AAB_SOURCE)
    ], cwd=PROJECT)

    print("AAB signature verification completed.")


# ==================================================
# DEPLOY TO NGINX
# ==================================================

def deploy_to_nginx():

    print("\n[9/10] Deploying AAB to Nginx")

    run([
        "sudo", "mkdir", "-p", str(NGINX_DIR)
    ])

    run([
        "sudo", "chmod", "755", "/var"
    ])

    run([
        "sudo", "chmod", "755", "/var/www"
    ])

    run([
        "sudo", "chmod", "755", str(NGINX_DIR)
    ])

    run([
        "sudo", "install",
        "-m", "644",
        str(AAB_SOURCE),
        str(AAB_DEST)
    ])

    run(["sudo", "nginx", "-t"])

    run([
        "sudo", "systemctl", "reload", "nginx"
    ])

    print("AAB deployed successfully.")


# ==================================================
# VERIFY DOWNLOAD
# ==================================================

def verify_deployment():

    print("\n[10/10] Testing download URL")

    if not AAB_DEST.exists():
        raise FileNotFoundError(
            "AAB missing from Nginx directory."
        )

    if AAB_SOURCE.stat().st_size != AAB_DEST.stat().st_size:
        raise RuntimeError("Deployed AAB size mismatch.")

    request = Request(
        DOWNLOAD_URL,
        method="HEAD"
    )

    with urlopen(request, timeout=30) as response:

        if response.status != 200:
            raise RuntimeError(
                f"Download failed: HTTP {response.status}"
            )

        print("HTTP Status:", response.status)

    print("Download URL verified.")


# ==================================================
# MAIN
# ==================================================

def main():

    print("=" * 60)
    print("EXPENSE MANAGER - AUTOMATIC ANDROID DEPLOYMENT")
    print("=" * 60)

    try:

        if not (PROJECT / ".git").exists():
            raise RuntimeError("Git repository not found.")

        env = get_signing_credentials()

        backup_local_changes()

        update_repository()

        install_dependencies()

        verify_keystore(env)

        clean_gradle()

        build_aab(env)

        verify_signature()

        deploy_to_nginx()

        verify_deployment()

        print("\n" + "=" * 60)
        print("SUCCESS: ANDROID AAB DEPLOYED")
        print("=" * 60)

        print("\nGitHub repository:")
        print(REPOSITORY)

        print("\nAAB location:")
        print(AAB_DEST)

        print("\nDownload URL:")
        print(DOWNLOAD_URL)

    except subprocess.CalledProcessError as error:

        print("\nDEPLOYMENT FAILED")
        print("Command exit code:", error.returncode)
        sys.exit(1)

    except Exception as error:

        print("\nDEPLOYMENT FAILED")
        print(error)
        sys.exit(1)


if __name__ == "__main__":
    main()
