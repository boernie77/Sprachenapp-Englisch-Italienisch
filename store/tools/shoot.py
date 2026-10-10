# Hilfsskript für App-Store-Screenshots (Simulator). Pfade B/APP oben anpassen. Ablauf: Debug-Build für den Simulator, `tour.template.js`
# als public/app-config.local.js in die gebaute .app legen (NUR Test, nie ins Repo/Release), 1. Start füllt Daten, 2. Start zeigt die Szenen.
import subprocess, sys, time, shutil, os
B = '/private/tmp/claude-501/-Users-christian-Projekte-Neue-Lernapp/49f23a77-6182-4065-be0b-907b346d6a2f/scratchpad'
APP = f'{B}/dd/Build/Products/Debug-iphonesimulator/Vokabeln Multi.app'
DEVICES = {'iphone': 'F97A2811-6836-4C3E-B6CA-5FF9059588A5', 'ipad': '36054D81-8E97-4C83-AF8B-189BFD6849F6'}
BUNDLE = 'com.bernauer24.vokabeln'
SCENES = ['dragdrop', 'quiz', 'cards', 'write', 'grammar', 'stats', 'vocablist', 'ai', 'data']
FIRST = float(os.environ.get('FIRST', '8'))   # Sekunden ab Start bis zur ersten Szene
def sh(*a): return subprocess.run(a, capture_output=True, text=True)

def shoot(dev, ui, out):
    udid = DEVICES[dev]
    os.makedirs(out, exist_ok=True)
    sh('xcrun', 'simctl', 'boot', udid); sh('xcrun', 'simctl', 'bootstatus', udid, '-b')
    sh('xcrun', 'simctl', 'status_bar', udid, 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100', '--cellularBars', '4', '--wifiBars', '3', '--operatorName', '')
    sh('xcrun', 'simctl', 'uninstall', udid, BUNDLE)
    tmp = f'{B}/store/app-{dev}-{ui}'
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.copytree(APP, tmp + '/Vokabeln Multi.app', symlinks=True)
    tour = open(f'{B}/store/tour.template.js', encoding='utf8').read().replace('__UI__', ui)
    open(f'{tmp}/Vokabeln Multi.app/public/app-config.local.js', 'w', encoding='utf8').write(tour)
    r = sh('xcrun', 'simctl', 'install', udid, f'{tmp}/Vokabeln Multi.app')
    if r.returncode: print(r.stderr); return
    sh('xcrun', 'simctl', 'launch', udid, BUNDLE)      # 1. Start: Daten vorbereiten
    time.sleep(40)
    sh('xcrun', 'simctl', 'terminate', udid, BUNDLE); time.sleep(2)
    t0 = time.time(); sh('xcrun', 'simctl', 'launch', udid, BUNDLE)   # 2. Start: Szenen
    for i, name in enumerate(SCENES):
        target = t0 + FIRST + 6 * i
        time.sleep(max(0, target - time.time()))
        sh('xcrun', 'simctl', 'io', udid, 'screenshot', f'{out}/{i+1:02d}-{name}.png')
        print(dev, ui, name, flush=True)
    sh('xcrun', 'simctl', 'terminate', udid, BUNDLE)

if __name__ == '__main__':
    shoot(sys.argv[1], sys.argv[2], f'{B}/store/shots/{sys.argv[1]}-{sys.argv[2]}')
