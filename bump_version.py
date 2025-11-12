#!/usr/bin/env python3
"""
Version bumping utility for the AI Resume Tailoring Platform

Usage:
    python bump_version.py <component> <bump_type>

    component: 'backend', 'frontend', or 'both'
    bump_type: 'major', 'minor', or 'patch'

Examples:
    python bump_version.py backend patch    # 2.0.0 -> 2.0.1
    python bump_version.py frontend minor   # 2.0.0 -> 2.1.0
    python bump_version.py both major       # 2.0.0 -> 3.0.0
"""

import sys
import os
from pathlib import Path

def read_version(file_path):
    """Read version from VERSION file"""
    with open(file_path, 'r') as f:
        return f.read().strip()

def write_version(file_path, version):
    """Write version to VERSION file"""
    with open(file_path, 'w') as f:
        f.write(f"{version}\n")

def bump_version(version, bump_type):
    """Bump version based on type (major, minor, patch)"""
    major, minor, patch = map(int, version.split('.'))

    if bump_type == 'major':
        return f"{major + 1}.0.0"
    elif bump_type == 'minor':
        return f"{major}.{minor + 1}.0"
    elif bump_type == 'patch':
        return f"{major}.{minor}.{patch + 1}"
    else:
        raise ValueError(f"Invalid bump type: {bump_type}. Use 'major', 'minor', or 'patch'")

def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    component = sys.argv[1].lower()
    bump_type = sys.argv[2].lower()

    if component not in ['backend', 'frontend', 'both']:
        print(f"Error: Invalid component '{component}'. Use 'backend', 'frontend', or 'both'")
        sys.exit(1)

    if bump_type not in ['major', 'minor', 'patch']:
        print(f"Error: Invalid bump type '{bump_type}'. Use 'major', 'minor', or 'patch'")
        sys.exit(1)

    components = ['backend', 'frontend'] if component == 'both' else [component]

    for comp in components:
        version_file = Path(comp) / 'VERSION'

        if not version_file.exists():
            print(f"Error: {version_file} not found")
            sys.exit(1)

        old_version = read_version(version_file)
        new_version = bump_version(old_version, bump_type)
        write_version(version_file, new_version)

        # For frontend, also update public/VERSION
        if comp == 'frontend':
            public_version_file = Path(comp) / 'public' / 'VERSION'
            if public_version_file.exists():
                write_version(public_version_file, new_version)
                print(f"{comp.capitalize()}: {old_version} -> {new_version} (updated both VERSION and public/VERSION)")
            else:
                print(f"{comp.capitalize()}: {old_version} -> {new_version}")
        else:
            print(f"{comp.capitalize()}: {old_version} -> {new_version}")

    print("\nDone! Don't forget to update CHANGELOG.md files with your changes.")

if __name__ == '__main__':
    main()
