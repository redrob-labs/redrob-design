#!/usr/bin/env bash
#
# Create (or reuse) the GitHub Release for a tag as a DRAFT, upload every staged asset one at a time
# with retries, verify that the release holds exactly the staged files, and only then publish it.
#
# One asset per `gh release upload`, because a multi-asset upload is atomic: one transient 5xx on the
# twentieth file rolls back the whole release and discards every platform's build. The draft leaves
# only once the uploaded names match the staged names, so a half-uploaded release is never public.
#
# Usage: publish-release.sh <tag> <assets-dir> <notes-file>
# Environment: GH_TOKEN, GH_REPO
set -euo pipefail

tag="${1:?a tag is required}"
assets="${2:?an assets directory is required}"
notes="${3:?a release-notes file is required}"

staged=()
while IFS= read -r file; do staged+=("$file"); done < <(find "$assets" -maxdepth 1 -type f | sort)
if [ "${#staged[@]}" -eq 0 ]; then
  echo "::error::$assets holds no files to release" >&2
  exit 1
fi

if gh release view "$tag" --json isDraft --jq .isDraft >/dev/null 2>&1; then
  if [ "$(gh release view "$tag" --json isDraft --jq .isDraft)" != "true" ]; then
    echo "::error::release $tag is already published; refusing to overwrite its assets" >&2
    exit 1
  fi
  echo "Reusing the existing draft release $tag"
  gh release edit "$tag" --title "$tag" --notes-file "$notes" >/dev/null
else
  gh release create "$tag" --draft --verify-tag --title "$tag" --notes-file "$notes" >/dev/null
  echo "Created draft release $tag"
fi

for file in "${staged[@]}"; do
  name="$(basename "$file")"
  attempt=1
  until gh release upload "$tag" "$file" --clobber; do
    if [ "$attempt" -ge 5 ]; then
      echo "::error::failed to upload $name after $attempt attempts" >&2
      exit 1
    fi
    sleep $((attempt * 15))
    attempt=$((attempt + 1))
  done
  echo "uploaded $name"
done

expected="$(for file in "${staged[@]}"; do basename "$file"; done | sort)"
uploaded="$(gh release view "$tag" --json assets --jq '.assets[].name' | sort)"
if [ "$expected" != "$uploaded" ]; then
  echo "::error::the release's assets do not match the staged files" >&2
  diff <(echo "$expected") <(echo "$uploaded") >&2 || true
  exit 1
fi

gh release edit "$tag" --draft=false >/dev/null
echo "Published $tag with ${#staged[@]} asset(s):"
echo "$uploaded"
