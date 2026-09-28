# Access

How to reach the Vesta VPS: SSH, key management, the Contabo portal, the Contabo API, lockout recovery, and credential rotation.

See [README.md](./README.md) for the server inventory (IPs, OS, resources).

---

## 1. SSH

### Alias (recommended)

`~/.ssh/config` on the admin Mac already has:

```
Host vesta
    HostName 62.171.155.231
    User vesta
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

```bash
ssh vesta
```

### Full form

```bash
ssh -i ~/.ssh/id_ed25519 vesta@62.171.155.231
```

### IPv6

```bash
ssh -i ~/.ssh/id_ed25519 vesta@2a02:c207:2361:2692::1
```

### GUI clients

| Client | Settings |
|---|---|
| Termius | Host `62.171.155.231`, port `22`, user `vesta`, key `~/.ssh/id_ed25519` |
| VS Code Remote-SSH | Uses `~/.ssh/config` automatically — pick host `vesta` from the Remote Explorer, or add the same block to `Remote.SSH: Config File` |

Root login is possible (`ssh root@62.171.155.231`, password = Contabo secret "Circle Root", key also installed) but prefer `vesta` + `sudo` for day-to-day work.

---

## 2. Users & keys

### Add a teammate's or machine's key

```bash
# from the admin Mac, with the new public key file at hand
cat new_teammate.pub | ssh vesta 'umask 077; cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys'
```

Confirm it landed:

```bash
ssh vesta 'cat ~/.ssh/authorized_keys'
```

### Remove a key

Edit the file directly and delete the matching line (match on the trailing comment, e.g. `user@laptop`):

```bash
ssh vesta 'nano ~/.ssh/authorized_keys'
```

Or non-interactively, filtering out a unique substring (`OLD_MARKER`, e.g. the key comment or a fingerprint fragment):

```bash
ssh vesta "grep -v 'OLD_MARKER' ~/.ssh/authorized_keys > /tmp/ak.new && mv /tmp/ak.new ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Verify with `ssh-keygen -lf ~/.ssh/authorized_keys` to list fingerprints before/after.

### Create an additional sudo user

```bash
ssh vesta
sudo adduser --disabled-password --gecos "" newadmin
sudo usermod -aG sudo newadmin
sudo mkdir -p /home/newadmin/.ssh
echo "<their public key>" | sudo tee /home/newadmin/.ssh/authorized_keys
sudo chown -R newadmin:newadmin /home/newadmin/.ssh
sudo chmod 700 /home/newadmin/.ssh
sudo chmod 600 /home/newadmin/.ssh/authorized_keys

# optional: passwordless sudo, matching the vesta user
echo "newadmin ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/91-newadmin
sudo chmod 440 /etc/sudoers.d/91-newadmin
```

### Why `vesta` has no password

`vesta` is locked (`passwd -S vesta` → `L`) so there is nothing to guess — it can only authenticate with a key, regardless of what `PasswordAuthentication` is set to in sshd. Sudo is passwordless via `/etc/sudoers.d/90-vesta` because the account is already key-gated; this is a deliberate tradeoff for a small-team single-purpose VPS, not an oversight. Full sshd hardening (disabling root password login, disabling `PasswordAuthentication`) is planned but not yet applied — see [02-server-setup.md](./02-server-setup.md).

---

## 3. Contabo portal

Portal: <https://my.contabo.com>

### Secret Management

Portal → **Secret Management**. Stores named secrets (passwords, SSH keys) that can be referenced by Reset password / Reinstall actions, or read via the API (`GET /v1/secrets`). Current secrets: "Circle Root" (the current root password) and "vesta" (a stale password, not valid for any login).

Storing a secret here does **nothing to the server** on its own — it only takes effect when you apply it through an action below (Reset password, Reinstall).

### Reset password flow (reboots the server)

Portal → instance `vmi3612692` → **Reset password**. Pick the "Circle Root" secret (or a new one) as the root password, optionally attach an SSH key secret. This **reboots the instance**. Last applied 2026-09-28 06:28 UTC with secret "Circle Root".

### Rescue system flow (boot to a recovery image)

Portal → instance → **Rescue system**. Boots a minimal Linux image with the real disk unmounted. From the rescue shell (over SSH or VNC, credentials shown in the portal for the rescue session):

```bash
lsblk                  # confirm the real root filesystem, e.g. /dev/sda1
mount /dev/sda1 /mnt
chroot /mnt
passwd root             # or: passwd vesta
exit
umount /mnt
reboot
```

Reboot again from the portal to leave rescue mode and boot the normal system.

### Reinstall (last resort — wipes the disk)

Portal → instance → **Reinstall**. Wipes the whole disk and reinstalls the OS. Only use this if Rescue system can't recover the box; re-run the full bootstrap in [02-server-setup.md](./02-server-setup.md) afterward.

### VNC (emergency console access)

VNC address: `169.58.1.198:63026`. Set a separate VNC password via the lock icon next to the instance in the portal (max ~8 characters, unencrypted — emergency use only, not for routine access).

```bash
# macOS
open vnc://169.58.1.198:63026
```

Fallback: any VNC client (RealVNC Viewer, TigerVNC) — connect to host `169.58.1.198`, port `63026`, with the VNC password set above.

---

## 4. Contabo API

The API needs four values, all from <https://my.contabo.com/api/details>:

| Value | Env var |
|---|---|
| Client ID | `CNTB_CLIENT_ID` |
| Client secret | `CNTB_CLIENT_SECRET` |
| API user email | `CNTB_API_USER` |
| API password | `CNTB_API_PASSWORD` |

Store them locally, never in the repo:

```bash
mkdir -p ~/.config/contabo
cat > ~/.config/contabo/creds.env <<'EOF'
CNTB_CLIENT_ID=<from Contabo API page>
CNTB_CLIENT_SECRET=<from password manager>
CNTB_API_USER=<from Contabo API page>
CNTB_API_PASSWORD=<from password manager>
EOF
chmod 600 ~/.config/contabo/creds.env
```

### Get a token

```bash
source ~/.config/contabo/creds.env

TOKEN=$(curl -s https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token \
  -d grant_type=password \
  -d client_id="$CNTB_CLIENT_ID" \
  -d client_secret="$CNTB_CLIENT_SECRET" \
  -d username="$CNTB_API_USER" \
  -d password="$CNTB_API_PASSWORD" \
  | jq -r .access_token)
```

Every API call needs `Authorization: Bearer $TOKEN` and a fresh `x-request-id`:

```bash
# zsh note: don't name this function `g` — it clashes with a common alias
cget() {
  curl -s -H "Authorization: Bearer $TOKEN" -H "x-request-id: $(uuidgen | tr A-Z a-z)" "$@"
}
```

### Read-only recipes

```bash
cget https://api.contabo.com/v1/compute/instances | python3 -m json.tool
cget https://api.contabo.com/v1/compute/instances/203612692 | jq
cget https://api.contabo.com/v1/secrets | jq
cget "https://api.contabo.com/v1/compute/instances/actions/audits?instanceId=203612692" | jq
```

### Mutating recipes (warning: these reboot the instance)

```bash
# reset password/keys — <secretId> values come from GET /v1/secrets
curl -s -X POST https://api.contabo.com/v1/compute/instances/203612692/actions/resetPassword \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-request-id: $(uuidgen | tr A-Z a-z)" \
  -H "Content-Type: application/json" \
  -d '{"sshKeys": [<secretId>], "rootPassword": <secretId>}'

# restart
curl -s -X POST https://api.contabo.com/v1/compute/instances/203612692/actions/restart \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-request-id: $(uuidgen | tr A-Z a-z)"
```

---

## 5. Lockout recovery decision tree

Work down the list; each step is a fallback for the one above it.

1. **`ssh vesta` fails** → try the `vesta` key explicitly: `ssh -i ~/.ssh/id_ed25519 vesta@62.171.155.231`.
2. **Still fails** → try root with the same key: `ssh -i ~/.ssh/id_ed25519 root@62.171.155.231`.
3. **Key rejected entirely** → try root with the password (Contabo secret "Circle Root"): `ssh root@62.171.155.231` (password auth).
4. **No SSH at all** → open the VNC console (§3) and work from the local terminal.
5. **VNC also fails / server unresponsive** → portal **Reset password** (§3) — reboots, reapplies root password/key from a secret.
6. **Still can't get in / filesystem-level problem** → **Rescue system** (§3) — mount the disk, `chroot`, fix `passwd`/`authorized_keys` directly.
7. **Nothing else works** → **Reinstall** (§3), last resort, wipes the disk. Rebuild from [02-server-setup.md](./02-server-setup.md).

---

## 6. Credential rotation checklist

- [ ] **Rotate the Contabo API client secret and API password** — these were shared in a chat on 2026-09-28 and must be treated as compromised. Generate new values at <https://my.contabo.com/api/details>, update `~/.config/contabo/creds.env` (§4), and confirm the old values no longer authenticate.
- [ ] Rotate the root password: portal **Reset password** (§3) with a freshly generated secret; update the "Circle Root" secret in Secret Management; delete the stale "vesta" secret if no longer needed.
- [ ] Remove old/unused keys from `/home/vesta/.ssh/authorized_keys` and `/root/.ssh/authorized_keys` (§2) whenever a teammate's device changes or access is revoked.
- [ ] After any rotation, verify access still works (`ssh vesta`, `ssh root@...`) **before** closing out old credentials.

---

## Troubleshooting / Gotchas

- **Contabo "User Management" ≠ Linux users.** It creates portal sub-users (for logging into my.contabo.com), not accounts on the server. Use §2 for actual Linux users.
- **Portal "Add SSH key" form rejects ed25519 keys** with "SSH-Key is not valid" if the key has a trailing newline or stray characters (Grammarly-style browser extensions can mangle a pasted key). Strip the comment/newline before pasting, use an RSA 4096 key instead, or skip the portal form entirely and use `ssh-copy-id` / manual `authorized_keys` edits (§2).
- **Storing a secret in Contabo Secret Management does nothing by itself.** It only takes effect once referenced by an action like Reset password or Reinstall (§3).
- **Repeated failed password SSH attempts can trigger a ban.** Stop after 2-3 failures and fall back to the next step in the decision tree (§5) instead of retrying.
- **`perl: warning: Setting locale failed` over SSH from macOS** is harmless — macOS forwards `LC_CTYPE=UTF-8` by default. Fix optionally with `SendEnv`/`SetEnv` tweaks in `~/.ssh/config`, or install the locale on the server; not worth chasing otherwise.
