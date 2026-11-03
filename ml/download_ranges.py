"""Bounded, resumable HTTP ranges for the two official FER+ dependencies."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent / 'data'


def retrieve(url, target, size, sha256):
    if target.exists() and target.stat().st_size == size and hashlib.sha256(target.read_bytes()).hexdigest() == sha256:
        print(f'Already verified {target.name}', flush=True)
        return
    chunk_size = 1024 * 1024
    def part(index):
        start, end = index * chunk_size, min(size, (index + 1) * chunk_size)
        path = target.with_name(f'{target.name}.{index:03d}.part')
        for attempt in range(8):
            offset = path.stat().st_size if path.exists() else 0
            if offset == end - start:
                return path
            try:
                request = urllib.request.Request(url, headers={'Range': f'bytes={start + offset}-{end - 1}'})
                with urllib.request.urlopen(request, timeout=25) as response:
                    if response.status != 206 or not response.headers.get('Content-Range', '').startswith(f'bytes {start + offset}-'):
                        raise RuntimeError('Requested range not honoured')
                    with path.open('ab') as output:
                        remaining = end - start - offset
                        while remaining:
                            data = response.read(min(64 * 1024, remaining))
                            if not data:
                                raise RuntimeError('Incomplete range')
                            output.write(data)
                            remaining -= len(data)
                print(f'{target.name}: {index + 1}/{(size + chunk_size - 1) // chunk_size}', flush=True)
                return path
            except Exception:
                if attempt == 7:
                    raise
                time.sleep(attempt + 1)
    with ThreadPoolExecutor(max_workers=8) as pool:
        paths = list(pool.map(part, range((size + chunk_size - 1) // chunk_size)))
    with target.open('wb') as output:
        for path in paths:
            output.write(path.read_bytes())
    assert target.stat().st_size == size
    assert hashlib.sha256(target.read_bytes()).hexdigest() == sha256
    print(f'PASS {target.name} SHA-256', flush=True)


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    if sys.argv[1] == 'runtime':
        metadata = ROOT / 'onnx-wheel-source.json'
        if not metadata.exists():
            with urllib.request.urlopen('https://pypi.org/pypi/onnxruntime/1.23.2/json', timeout=30) as response:
                release = json.load(response)
            tag = f'cp{sys.version_info.major}{sys.version_info.minor}'
            source = next(item for item in release['urls'] if f'{tag}-{tag}-win_amd64.whl' in item['filename'])
            metadata.write_text(json.dumps(source, indent=2), encoding='utf-8')
        source = json.loads(metadata.read_text(encoding='utf-8-sig'))
        retrieve(source['url'], ROOT / source['filename'], source['size'], source['digests']['sha256'])
    else:
        retrieve('https://media.githubusercontent.com/media/onnx/models/main/validated/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx',
                 ROOT / 'pretrained-ferplus.onnx', 35040571, 'a2a2ba6a335a3b29c21acb6272f962bd3d47f84952aaffa03b60986e04efa61c')
        with urllib.request.urlopen('https://raw.githubusercontent.com/microsoft/FERPlus/master/fer2013new.csv', timeout=30) as response:
            (ROOT / 'ferplus-labels.csv').write_bytes(response.read())
