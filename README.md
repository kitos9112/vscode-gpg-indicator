# GPG Key Status Indicator and Unlocker for VS Code

Show the status of the GPG signing key for your project!

You can also also unlock the key by clicking the status bar element. :D

![stats bar sample](./images/status-bar.png)

## Features

This extension will show the status of GPG signing key in status bar if your local project folder `.git` or any other default `.gitconfig` configuration file (e.g. `~/.gitconfig`):

- has set `commit.gpgSign` as `true` for git, and
- has set `user.signingKey` with GPG key ID for git

If the above conditions are both satisfied, there will be an indicator for your current
signing key, together with a cute icon to tell whether the key is unlocked or not.

When you click the indicator, you will be prompted for passphrase to unlock the key.

## Requirements

- Linux environment (It's not been tested on other platform)
- GPG tool chain (`gpg`, `gpg-agent`, `gpg-connect-agent`) above 2.1
- `expect` tool by Don Libes: [Links](https://core.tcl-lang.org/expect/index)
  - You can get this tool on most Linux distribution.

Current implementation require a pty between this extension and GPG tools to send passphrase,
so we use `expect` to handle this. I wish I can remove this dependency in the future.

## Extension Settings

Currently there is no setting available.

## Known Issues

Multi-folder workspace is not supported yet.

## Release Notes

### 0.3.1

Add message for unlock action and fix security issue.

### 0.3.0

Design and add icon for this package.

### 0.2.0

User can unlock the key by clicking the status bar element.

### 0.1.0

Initial release. User can check the status of project signing key.
