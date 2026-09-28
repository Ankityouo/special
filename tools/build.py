#!/usr/bin/env python3
"""Bundle Cosmic Address into a single self-contained HTML file.

    python3 tools/build.py                   # -> dist/cosmic-address.html (full document)
    python3 tools/build.py --fragment OUT    # -> page body only, for hosts that add their own
                                             #    <html>/<head>/<body> skeleton

index.html already runs as-is (open it in a browser, or serve the folder);
the bundle is for sharing one file.
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    html = read('index.html')
    block = re.search(r'<!-- build:scripts -->(.*?)<!-- /build:scripts -->', html, re.S)
    if not block:
        raise SystemExit('script block markers not found in index.html')
    srcs = re.findall(r'<script src="([^"]+)"></script>', block.group(1))
    inline = []
    for src in srcs:
        code = read(src)
        if '</script' in code.lower():
            raise SystemExit('refusing to inline %s: contains a closing script tag' % src)
        inline.append('<script>/* %s */\n%s\n</script>' % (src, code))
    scripts = '\n'.join(inline)
    full = html[: block.start()] + scripts + html[block.end():]

    args = sys.argv[1:]
    if args[:1] == ['--fragment']:
        out = args[1] if len(args) > 1 else os.path.join(ROOT, 'dist', 'fragment.html')
        head = re.search(r'<head>(.*?)</head>', full, re.S).group(1)
        body = re.search(r'<body>(.*)</body>', full, re.S).group(1)
        keep = []
        for tag in re.findall(r'<title>.*?</title>|<link [^>]+>|<style>.*?</style>', head, re.S):
            keep.append(tag)
        frag = '\n'.join(keep) + '\n' + body.strip() + '\n'
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with open(out, 'w', encoding='utf-8') as f:
            f.write(frag)
        print('wrote %s (%.1f KB)' % (out, len(frag.encode('utf-8')) / 1024))
        return

    out = os.path.join(ROOT, 'dist', 'cosmic-address.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(full)
    print('wrote %s (%.1f KB)' % (out, len(full.encode('utf-8')) / 1024))


if __name__ == '__main__':
    main()
