#!/usr/bin/env bash
#
# Print `version=<x.y.z>` for $GITHUB_OUTPUT, from desktop/tauri.conf.json.
#
# On a tag build the tag must agree with the manifest: a tag pushed before the version bump landed
# would otherwise release 0.15.1's name over 0.15.0's bytes, and the launcher would install the wrong
# build believing it the right one. On a workflow_dispatch build there is no tag to compare.
set -euo pipefail

version="$(node -p "require('./desktop/tauri.conf.json').version")"
case "${GITHUB_REF:-}" in
refs/tags/v*)
  tag_version="${GITHUB_REF#refs/tags/v}"
  if [ "$tag_version" != "$version" ]; then
    echo "::error::tag v$tag_version does not match desktop/tauri.conf.json version $version" >&2
    exit 1
  fi
  ;;
esac
echo "version=$version"
