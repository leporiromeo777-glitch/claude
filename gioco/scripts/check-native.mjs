#!/usr/bin/env node
// TRAMA: controllo dei progetti nativi (android/, ios/) contro ARCHITETTURA 13 e GDD 17.
//
// Uso: npm run native:check      (esce con 1 se qualcosa non torna)
//
// Serve soprattutto dopo un aggiornamento di Capacitor o dopo aver rigenerato i
// progetti con "npx cap add": verifica che le impostazioni fatte a mano ci siano ancora.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok: Boolean(ok), detail });
}

function read(rel) {
  const abs = join(ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

// --- Plist XML minimale (dict, array, string, integer, real, true, false, data, date) ---
function parsePlist(xml) {
  const body = xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const tokens = [...body.matchAll(/<(\/?)([A-Za-z]+)(?:\s[^>]*?)?(\/?)>|([^<]+)/g)];
  let i = 0;
  const next = () => tokens[i++];
  const skipText = () => {
    while (i < tokens.length && tokens[i][4] !== undefined && tokens[i][4].trim() === '') i++;
  };
  const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  function value() {
    skipText();
    const t = next();
    if (!t || t[4] !== undefined) throw new Error('plist: valore atteso');
    const [, close, tag, selfClose] = t;
    if (close) throw new Error(`plist: chiusura inattesa </${tag}>`);
    if (tag === 'plist') {
      const v = value();
      skipText();
      next();
      return v;
    }
    if (tag === 'true' || tag === 'false') {
      if (!selfClose) next();
      return tag === 'true';
    }
    if (tag === 'dict') {
      const out = {};
      if (selfClose) return out;
      for (;;) {
        skipText();
        const k = next();
        if (k[1] && k[2] === 'dict') return out;
        if (k[2] !== 'key') throw new Error('plist: <key> atteso');
        const text = tokens[i] && tokens[i][4] !== undefined ? decode(next()[4]) : '';
        next(); // </key>
        out[text.trim()] = value();
      }
    }
    if (tag === 'array') {
      const out = [];
      if (selfClose) return out;
      for (;;) {
        skipText();
        const t2 = tokens[i];
        if (t2[1] && t2[2] === 'array') {
          i++;
          return out;
        }
        out.push(value());
      }
    }
    if (selfClose) return tag === 'string' ? '' : null;
    const text = tokens[i] && tokens[i][4] !== undefined ? decode(next()[4]) : '';
    next(); // chiusura
    if (tag === 'integer') return Number.parseInt(text, 10);
    if (tag === 'real') return Number.parseFloat(text);
    return text;
  }
  return value();
}

// --- PNG: dimensioni e tipo di colore dall'intestazione IHDR ---
function pngInfo(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return null;
  const b = readFileSync(abs);
  if (b.length < 33 || b.readUInt32BE(12) !== 0x49484452) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

// --- appId da capacitor.config.ts ---
const capConfig = read('capacitor.config.ts') ?? '';
const appId = /appId:\s*'([^']+)'/.exec(capConfig)?.[1];
check('capacitor.config.ts: appId it.trama.merletto', appId === 'it.trama.merletto', appId ?? 'appId non trovato');

// --- Android ---
const manifest = read('android/app/src/main/AndroidManifest.xml');
check('android/: progetto presente', manifest !== null, 'manca android/app/src/main/AndroidManifest.xml');
if (manifest !== null) {
  const application = /<application\b[^>]*>/.exec(manifest)?.[0] ?? '';
  const activity = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/.exec(manifest)?.[0] ?? '';
  check('AndroidManifest: android:appCategory="game" su <application>', /android:appCategory="game"/.test(application));
  check('AndroidManifest: android:screenOrientation="fullUser" su MainActivity', /android:screenOrientation="fullUser"/.test(activity));
}
const variables = read('android/variables.gradle') ?? '';
const gradleNum = (name) => Number(new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(variables)?.[1]);
check('variables.gradle: minSdk 24', gradleNum('minSdkVersion') === 24, String(gradleNum('minSdkVersion')));
check('variables.gradle: compileSdk 36', gradleNum('compileSdkVersion') === 36, String(gradleNum('compileSdkVersion')));
check('variables.gradle: targetSdk 36', gradleNum('targetSdkVersion') === 36, String(gradleNum('targetSdkVersion')));
const appGradle = read('android/app/build.gradle') ?? '';
const applicationId = /applicationId\s+"([^"]+)"/.exec(appGradle)?.[1];
check('app/build.gradle: applicationId uguale ad appId', applicationId === appId, applicationId ?? 'non trovato');
check('app/build.gradle: firma di rilascio solo da variabili d\'ambiente', /environmentVariable\('KEYSTORE_PATH'\)/.test(appGradle) && !/storePassword\s+["']/.test(appGradle));

const res = 'android/app/src/main/res';
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const icon = pngInfo(`${res}/mipmap-${density}/ic_launcher.png`);
  const fg = pngInfo(`${res}/mipmap-${density}/ic_launcher_foreground.png`);
  check(`Android: icone mipmap-${density}`, icon !== null && fg !== null);
}
check('Android: icona adattiva (mipmap-anydpi-v26)', existsSync(join(ROOT, `${res}/mipmap-anydpi-v26/ic_launcher.xml`)));
check('Android: splash (drawable/splash.png)', pngInfo(`${res}/drawable/splash.png`) !== null);
const styles = read(`${res}/values/styles.xml`) ?? '';
check('Android: fondo della schermata d\'avvio #1C2233', /windowSplashScreenBackground">@color\/trama_velluto/.test(styles) && /#1C2233/i.test(read(`${res}/values/ic_launcher_background.xml`) ?? ''));

// --- iOS ---
const infoXml = read('ios/App/App/Info.plist');
check('ios/: progetto presente', infoXml !== null, 'manca ios/App/App/Info.plist');
if (infoXml !== null) {
  let info = {};
  try {
    info = parsePlist(infoXml);
    check('Info.plist: leggibile', true);
  } catch (err) {
    check('Info.plist: leggibile', false, String(err));
  }
  const phone = info.UISupportedInterfaceOrientations;
  check('Info.plist: iPhone solo Portrait', Array.isArray(phone) && phone.length === 1 && phone[0] === 'UIInterfaceOrientationPortrait', JSON.stringify(phone));
  const pad = info['UISupportedInterfaceOrientations~ipad'];
  const four = ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];
  check('Info.plist: iPad tutte e quattro le orientazioni', Array.isArray(pad) && four.every((o) => pad.includes(o)), JSON.stringify(pad));
  check('Info.plist: UIStatusBarHidden = true', info.UIStatusBarHidden === true);
  check('Info.plist: nessun UIRequiresFullScreen', !('UIRequiresFullScreen' in info));
  check('Info.plist: ITSAppUsesNonExemptEncryption = false', info.ITSAppUsesNonExemptEncryption === false);
}
const privacyXml = read('ios/App/App/PrivacyInfo.xcprivacy');
check('PrivacyInfo.xcprivacy: presente', privacyXml !== null);
if (privacyXml !== null) {
  let privacy = {};
  try {
    privacy = parsePlist(privacyXml);
  } catch (err) {
    check('PrivacyInfo.xcprivacy: leggibile', false, String(err));
  }
  check('PrivacyInfo: NSPrivacyTracking = false', privacy.NSPrivacyTracking === false);
  check('PrivacyInfo: nessun dominio di tracciamento', Array.isArray(privacy.NSPrivacyTrackingDomains) && privacy.NSPrivacyTrackingDomains.length === 0);
  check('PrivacyInfo: nessun dato raccolto', Array.isArray(privacy.NSPrivacyCollectedDataTypes) && privacy.NSPrivacyCollectedDataTypes.length === 0);
  const apis = Array.isArray(privacy.NSPrivacyAccessedAPITypes) ? privacy.NSPrivacyAccessedAPITypes : [];
  const userDefaults = apis.find((a) => a && a.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults');
  check('PrivacyInfo: UserDefaults con motivo CA92.1', Boolean(userDefaults) && Array.isArray(userDefaults.NSPrivacyAccessedAPITypeReasons) && userDefaults.NSPrivacyAccessedAPITypeReasons.includes('CA92.1'));
}
const pbx = read('ios/App/App.xcodeproj/project.pbxproj') ?? '';
const resourcesPhase = /isa = PBXResourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/.exec(pbx)?.[1] ?? '';
check('Xcode: PrivacyInfo.xcprivacy nelle risorse del target App', /PrivacyInfo\.xcprivacy in Resources/.test(resourcesPhase));
const bundleIds = [...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1]);
check('Xcode: PRODUCT_BUNDLE_IDENTIFIER uguale ad appId', bundleIds.length > 0 && bundleIds.every((b) => b === appId), bundleIds.join(', '));
check('Xcode: Swift Package Manager (niente CocoaPods)', /XCLocalSwiftPackageReference "CapApp-SPM"/.test(pbx) && !existsSync(join(ROOT, 'ios/App/Podfile')));

const appIcon = pngInfo('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
check('iOS: icona 1024×1024', appIcon !== null && appIcon.width === 1024 && appIcon.height === 1024, appIcon ? `${appIcon.width}×${appIcon.height}` : 'mancante');
check('iOS: icona senza trasparenza (l\'App Store la rifiuta)', appIcon !== null && appIcon.colorType !== 4 && appIcon.colorType !== 6, appIcon ? `tipo di colore PNG ${appIcon.colorType}` : '');
const splashDir = join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset');
const splashContents = read('ios/App/App/Assets.xcassets/Splash.imageset/Contents.json');
if (splashContents !== null) {
  const listed = new Set((JSON.parse(splashContents).images ?? []).map((im) => im.filename).filter(Boolean));
  const onDisk = readdirSync(splashDir).filter((f) => f.endsWith('.png'));
  check('iOS: splash presenti e tutti citati in Contents.json', listed.size > 0 && [...listed].every((f) => onDisk.includes(f)) && onDisk.every((f) => listed.has(f)), `${onDisk.length} file`);
} else {
  check('iOS: splash presenti', false, 'manca Splash.imageset/Contents.json');
}

// --- Nessuna chiave di firma dentro il progetto ---
const keyFiles = [];
function scan(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'build' || name === '.gradle' || name === 'dist') continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) scan(abs);
    else if (/\.(jks|keystore|p12|p8|mobileprovision)$/i.test(name)) keyFiles.push(relative(ROOT, abs));
  }
}
scan(ROOT);
check('Nessun keystore o certificato dentro gioco/', keyFiles.length === 0, keyFiles.join(', '));

// --- Rapporto ---
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  const mark = r.ok ? 'ok    ' : 'ERRORE';
  console.log(`${mark}  ${r.label}${!r.ok && r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} controlli superati.`);
process.exit(failed === 0 ? 0 : 1);
