"""Double-click via pythonw on Windows. Offline synthetic fixture only."""
import os
from pathlib import Path
import queue
import threading
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import shutil
import core

def drives():
    if os.name != "nt":
        return []
    import ctypes
    mask = ctypes.windll.kernel32.GetLogicalDrives()
    result = []
    for i in range(26):
        if mask & (1 << i):
            root = chr(65+i) + ":\\"
            if ctypes.windll.kernel32.GetDriveTypeW(root) in (2, 3):
                result.append(root)
    return result

def main():
    app = tk.Tk()
    app.title("Dawney Backup Companion - SYNTHETIC ONLY")
    app.geometry("660x410")
    app.minsize(600, 390)
    pane = ttk.Frame(app, padding=22)
    pane.pack(fill="both", expand=True)
    ttk.Label(pane, text="Dawney | Backup Companion", font=("Segoe UI", 18, "bold")).pack(anchor="w")
    ttk.Label(pane, text="OFFLINE SYNTHETIC FIXTURE • No database connection", wraplength=590).pack(anchor="w", pady=(5, 15))
    ttk.Label(pane, text="Choose a local drive:").pack(anchor="w")
    selected = tk.StringVar()
    picker = ttk.Combobox(pane, textvariable=selected, state="readonly", values=drives())
    picker.pack(fill="x")
    space = tk.StringVar(value="Select a drive to inspect available space.")
    status = tk.StringVar(value="Ready. Real administrator authentication and database backup are disabled.")
    ttk.Label(pane, textvariable=space, wraplength=590).pack(anchor="w", pady=6)
    ttk.Label(pane, text="Destination: DAWNEY_BACKUPS / STAGING / SYNTHETIC_FIXTURES").pack(anchor="w")
    ttk.Label(pane, text="Existing files preserved. Production and restore are unavailable.", wraplength=590).pack(anchor="w", pady=6)
    ttk.Label(pane, textvariable=status, wraplength=590).pack(anchor="w", pady=12)
    controls = ttk.Frame(pane)
    controls.pack(fill="x")
    events = queue.Queue()
    stopped = threading.Event()
    active = False

    def inspect(*_):
        try:
            if not selected.get():
                return
            root = Path(selected.get())
            core.root_identity(root)
            space.set("Available: {:.2f} GiB (fixture reserve: 16 MiB; not database sizing).".format(shutil.disk_usage(root).free / 1024**3))
        except (OSError, core.Refused):
            space.set("Drive unavailable. Choose another drive.")

    def refresh():
        if not active:
            picker.configure(values=drives())
            inspect()

    def begin():
        nonlocal active
        if active or not selected.get():
            return
        try:
            root = Path(selected.get())
            core.root_identity(root)
            exe = core.gpg_path()
            auth = core.FixtureAuthority()
            code = auth.challenge("fixture-system-administrator")
            answer = simpledialog.askstring("Simulated fresh authorization",
                "DEMO ONLY: this does not authenticate a real administrator.\nType this one-time fixture challenge: " + code, parent=app)
            if answer is None:
                status.set("CANCELLED — no export started.")
                return
            token = auth.confirm(answer)
        except (OSError, core.Refused) as exc:
            status.set(str(exc) if isinstance(exc, core.Refused) else "DRIVE_UNAVAILABLE")
            return
        active = True
        stopped.clear()
        start.configure(state="disabled")
        refresh_button.configure(state="disabled")
        picker.configure(state="disabled")
        cancel.configure(state="normal")
        status.set("Preparing fixture. Enter a separate passphrase in GnuPG Pinentry.")
        def work():
            try:
                receipt = core.backup(root, auth, token, core.Gpg(exe),
                                      cancel=stopped.is_set,
                                      progress=lambda phase: events.put(("progress", phase)))
                events.put(("done", receipt))
            except core.Refused as exc:
                events.put(("failed", str(exc)))
            except Exception:
                events.put(("failed", "UNEXPECTED_FAILURE"))
        threading.Thread(target=work, daemon=False).start()

    def pump():
        nonlocal active
        while True:
            try:
                kind, value = events.get_nowait()
            except queue.Empty:
                break
            if kind == "progress":
                status.set(value.replace("_", " ").capitalize() + " — synthetic fixture only.")
            else:
                active = False
                start.configure(state="normal")
                refresh_button.configure(state="normal")
                picker.configure(state="readonly")
                cancel.configure(state="disabled")
                if kind == "done":
                    status.set("VERIFIED SYNTHETIC FIXTURE\nSHA-256: " + value["sha256"])
                else:
                    status.set(value + " — NOT VERIFIED. Keep incomplete outputs separate; no automatic deletion.")
                inspect()
        app.after(100, pump)

    def close():
        if active:
            if messagebox.askyesno("Cancel operation?", "Request cancellation, then wait for NOT VERIFIED or verified result.", parent=app):
                stopped.set()
            return
        app.destroy()

    picker.bind("<<ComboboxSelected>>", inspect)
    refresh_button = ttk.Button(controls, text="Refresh drives", command=refresh)
    refresh_button.pack(side="left")
    start = ttk.Button(controls, text="Create synthetic backup", command=begin)
    start.pack(side="left", padx=10)
    cancel = ttk.Button(controls, text="Cancel", command=stopped.set, state="disabled")
    cancel.pack(side="left")
    app.protocol("WM_DELETE_WINDOW", close)
    app.after(100, pump)
    app.mainloop()

if __name__ == "__main__":
    main()
