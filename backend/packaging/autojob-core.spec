# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for JobSeeker sidecar (autojob-core).

Build: pyinstaller backend/packaging/autojob-core.spec
Console subsystem is MANDATORY so stdout handshake works cleanly.
"""

import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None
spec_dir = Path(SPECPATH).resolve()
BACKEND_DIR = spec_dir.parent
ROOT_DIR = BACKEND_DIR.parent

datas = [
    (str(BACKEND_DIR / "alembic"), "alembic"),
    (str(BACKEND_DIR / "alembic.ini"), "."),
]

# If templates dir exists
templates_dir = BACKEND_DIR / "templates"
if templates_dir.is_dir():
    datas.append((str(templates_dir), "templates"))

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespans",
    "uvicorn.lifespans.on",
    "sqlalchemy.sql.default_comparator",
    "sqlite3",
] + collect_submodules("app")

a = Analysis(
    [str(BACKEND_DIR / "app" / "cli.py")],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "notebook"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="autojob-core",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Mandatory for stdout handshake
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="autojob-core",
)
