#!/bin/sh
set -eu

Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp &
XVFB_PID=$!
export DISPLAY=:99

# Expose the server Chrome desktop to the embedded GEOFlow browser panel.
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -listen 0.0.0.0 -xkb -noxrecord -noxfixes -noxdamage >/tmp/tongzhuo-x11vnc.log 2>&1 &
VNC_PID=$!
websockify --web=/usr/share/novnc 6080 127.0.0.1:5900 >/tmp/tongzhuo-websockify.log 2>&1 &
WEBSOCKIFY_PID=$!
trap 'kill "$WEBSOCKIFY_PID" "$VNC_PID" "$XVFB_PID" 2>/dev/null || true' EXIT INT TERM

# Remove only stale browser process markers; keep browser profiles and login data.
rm -f /app/.data/browser-profile/SingletonLock \
  /app/.data/browser-profile/SingletonSocket \
  /app/.data/browser-profile/SingletonCookie

sleep 1
exec node server.mjs
