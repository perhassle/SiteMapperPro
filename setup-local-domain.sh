#!/bin/bash

# Setup script for sitemapperpro.local.se domain
# Run with: sudo ./setup-local-domain.sh

echo "Setting up sitemapperpro.local.se..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run with sudo: sudo ./setup-local-domain.sh"
  exit 1
fi

# Backup hosts file
cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d%H%M%S)

# Check if entry already exists
if grep -q "sitemapperpro.local.se" /etc/hosts; then
  echo "Entry for sitemapperpro.local.se already exists in /etc/hosts"
else
  # Add entry to hosts file
  echo "127.0.0.1       sitemapperpro.local.se" >> /etc/hosts
  echo "Added sitemapperpro.local.se to /etc/hosts"
fi

# Flush DNS cache (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  dscacheutil -flushcache
  echo "DNS cache flushed (macOS)"
fi

# Flush DNS cache (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if command -v systemd-resolve &> /dev/null; then
    systemd-resolve --flush-caches
    echo "DNS cache flushed (Linux systemd)"
  elif command -v service &> /dev/null; then
    service nscd restart 2>/dev/null || true
    service dnsmasq restart 2>/dev/null || true
    echo "DNS cache flushed (Linux)"
  fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the application: docker-compose up -d"
echo "2. Open in browser: http://sitemapperpro.local.se"
echo ""
echo "To remove the domain later, edit /etc/hosts and remove the line containing sitemapperpro.local.se"