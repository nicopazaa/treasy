/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function ensureFile(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing file: ${from}`);
  }
  fs.copyFileSync(from, to);
}

function patchIndexHtml(indexPath) {
  let html = fs.readFileSync(indexPath, 'utf8');

  const desiredViewport =
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />';
  if (html.includes('<meta name="viewport"')) {
    html = html.replace(/<meta name="viewport"[^>]*>/, desiredViewport);
  }

  if (!html.includes('apple-mobile-web-app-capable')) {
    const injection = [
      '    <meta name="apple-mobile-web-app-capable" content="yes" />',
      '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
      '    <meta name="apple-mobile-web-app-title" content="Treasy" />',
      '    <meta name="mobile-web-app-capable" content="yes" />',
      '    <meta name="theme-color" content="#0B1020" />',
      '',
      '    <link rel="manifest" href="/manifest.json" />',
      '    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />',
    ].join('\n');

    if (html.includes('</title>')) {
      html = html.replace(/<\/title>/, `</title>\n${injection}`);
    } else if (html.includes('</head>')) {
      html = html.replace(/<\/head>/, `${injection}\n  </head>`);
    }
  }

  fs.writeFileSync(indexPath, html, 'utf8');
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  const distDir = path.join(repoRoot, 'dist');
  const webDir = path.join(repoRoot, 'web');

  if (!fs.existsSync(distDir)) {
    throw new Error(`Missing dist directory: ${distDir}`);
  }

  // Copy PWA files into dist so Netlify can serve them.
  ensureFile(path.join(webDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
  ensureFile(path.join(webDir, 'apple-touch-icon.png'), path.join(distDir, 'apple-touch-icon.png'));
  ensureFile(path.join(webDir, 'icon-192.png'), path.join(distDir, 'icon-192.png'));
  ensureFile(path.join(webDir, 'icon-512.png'), path.join(distDir, 'icon-512.png'));

  // Patch the generated Expo index.html with iOS standalone tags.
  patchIndexHtml(path.join(distDir, 'index.html'));

  console.log('postexport-web: PWA meta + assets applied to dist/');
}

main();

