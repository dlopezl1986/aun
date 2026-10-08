#!/bin/sh
# Runs a command with the Firebase emulators (Auth + Firestore) on this machine.
# Needs the Firebase CLI and Java 11+ (a local JRE in ~/.local/java is picked up).
set -e
for j in "$HOME"/.local/java/*/Contents/Home "$HOME"/.local/java/*; do
  [ -x "$j/bin/java" ] && export JAVA_HOME="$j" && export PATH="$j/bin:$PATH" && break
done
export PATH="$HOME/.local/node/bin:$PATH"
exec firebase emulators:exec --only auth,firestore --project demo-aun "$1"
