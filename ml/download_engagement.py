"""Resumable ranged download of the author's CC BY 4.0 archive (192 MB)."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parent / 'data'
URL = 'https://zenodo.org/api/records/16731734/files/Final%20Dataset%20256.zip/content'
SIZE = 191946625
CHUNK = 4 * 1024 * 1024
ROOT.mkdir(exist_ok=True)


def download(index):
    start, end = index * CHUNK, min(SIZE, (index + 1) * CHUNK)
    path = ROOT / f'engagement.{index:03d}.part'
    for attempt in range(5):
        offset = path.stat().st_size if path.exists() else 0
        if offset == end - start:
            return path
        request = urllib.request.Request(URL, headers={'Range': f'bytes={start + offset}-{end - 1}'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 206 or not response.headers.get('Content-Range', '').startswith(f'bytes {start + offset}-'):
                    raise RuntimeError('Server did not honour the requested range')
                with path.open('ab') as output:
                    remaining = end - start - offset
                    while remaining:
                        data = response.read(min(256 * 1024, remaining))
                        if not data:
                            raise RuntimeError('Incomplete range')
                        output.write(data)
                        remaining -= len(data)
            print(f'Downloaded range {index + 1}/{(SIZE + CHUNK - 1) // CHUNK}', flush=True)
            return path
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1 + attempt)


if __name__ == '__main__':
    target = ROOT / 'engagement.zip'
    if target.exists() and target.stat().st_size == SIZE and hashlib.md5(target.read_bytes()).hexdigest() == '897ecb874df4c1ded4993d5264edfd3b':
        print('Archive already verified')
    else:
        with ThreadPoolExecutor(max_workers=8) as pool:
            paths = list(pool.map(download, range((SIZE + CHUNK - 1) // CHUNK)))
        with target.open('wb') as output:
            for path in paths:
                output.write(path.read_bytes())
        assert target.stat().st_size == SIZE
        assert hashlib.md5(target.read_bytes()).hexdigest() == '897ecb874df4c1ded4993d5264edfd3b'
        print('PASS archive size and author-published MD5 checksum', flush=True)
